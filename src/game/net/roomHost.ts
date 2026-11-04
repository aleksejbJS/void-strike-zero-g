// Connection handling around a GameRoom, independent of the transport:
// the Node server feeds it socket.io sockets, a browser host feeds it WebRTC peers.

import { GameRoom } from './room';
import { FixedStepper } from '../systems/fixedStep';
import { validateJoin, validateInput } from './validation';
import { MSG, SNAPSHOT_RATE, SPECTATOR_CAP, JoinAccepted, JoinRejected, WatchAccepted } from './protocol';
import { LOCAL_LINK_ID } from './hostProtocol';

const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_RATE;
// Timer granularity for the loop; the FixedStepper turns real elapsed time into exact ticks
const LOOP_INTERVAL_MS = 4;

/** One connected client, whatever carries its messages. */
export interface PeerLink {
    readonly id: string;
    send(event: string, data: unknown): void;
}

export class RoomHost {
    private readonly links = new Map<string, PeerLink>();
    private readonly joined = new Set<string>();
    /** Watch-only links: they get events and snapshots but never an entity. */
    private readonly spectators = new Set<string>();
    /** When each joined link last sent input (or joined): for rooms that drop silent players (idleKickMs). */
    private readonly lastInputAt = new Map<string, number>();
    private readonly stepper = new FixedStepper();
    private sinceSnapshot = 0;

    constructor(readonly room: GameRoom) {}

    connect(link: PeerLink) {
        this.links.set(link.id, link);
    }

    disconnect(id: string) {
        this.links.delete(id);
        this.spectators.delete(id);
        this.lastInputAt.delete(id);
        if (this.joined.delete(id)) this.room.leave(id);
    }

    /** A message from a client. Everything is validated — clients may send anything. */
    message(id: string, event: string, data: unknown, now = Date.now()) {
        const link = this.links.get(id);
        if (!link) return;

        if (event === MSG.JOIN) {
            const reject = (reason: JoinRejected['reason']) => link.send(MSG.JOIN_REJECTED, { reason } satisfies JoinRejected);
            if (this.joined.has(id) || this.spectators.has(id)) return reject('already_joined');
            const req = validateJoin(data);
            if (!req) return reject('invalid');
            const result = this.room.join(id, req);
            if (result.ok === false) return reject(result.reason);

            this.joined.add(id);
            this.lastInputAt.set(id, now);
            const accepted: JoinAccepted = {
                id,
                mode: this.room.state.mode,
                map: this.room.state.currentMap,
                platforms: this.room.state.platforms,
                snapshot: this.room.snapshot(now),
            };
            link.send(MSG.JOINED, accepted);
        } else if (event === MSG.WATCH) {
            // Players and existing spectators stay as they are; only a fresh link can start watching
            if (this.joined.has(id) || this.spectators.has(id)) return;
            if (!this.room.config.spectators) {
                link.send(MSG.JOIN_REJECTED, { reason: 'invalid' } satisfies JoinRejected);
                return;
            }
            if (this.spectators.size >= SPECTATOR_CAP) {
                link.send(MSG.JOIN_REJECTED, { reason: 'spectators_full' } satisfies JoinRejected);
                return;
            }
            this.spectators.add(id);
            const accepted: WatchAccepted = {
                mode: this.room.state.mode,
                map: this.room.state.currentMap,
                platforms: this.room.state.platforms,
                snapshot: this.room.snapshot(now),
            };
            link.send(MSG.WATCHING, accepted);
        } else if (event === MSG.INPUT && this.joined.has(id)) {
            const input = validateInput(data, now);
            if (input) this.room.pushInput(id, input);
            this.lastInputAt.set(id, now);
        }
    }

    /** Advance by `elapsedMs` of real time; sends events and snapshots to joined clients and spectators. */
    update(elapsedMs: number, now = Date.now()) {
        this.dropIdle(now);
        this.stepper.advance(elapsedMs, () => this.room.tick());

        this.sinceSnapshot += elapsedMs;
        if (this.sinceSnapshot < SNAPSHOT_INTERVAL_MS) return;
        this.sinceSnapshot = 0;

        const events = this.room.drainEvents();
        const snapshot = this.room.snapshot(now);
        for (const ids of [this.joined, this.spectators]) {
            for (const id of ids) {
                const link = this.links.get(id);
                if (!link) continue;
                if (events.length) link.send(MSG.EVENTS, events);
                link.send(MSG.SNAPSHOT, snapshot);
            }
        }
    }

    /**
     * A remote player that went silent (closed tab, lost network) leaves at once instead of standing there
     * frozen until PeerJS notices, which can take 60–90 s. Never the browser host's own player: a hidden tab
     * sends no input, but the host is still there.
     */
    private dropIdle(now: number) {
        const limit = this.room.config.idleKickMs;
        if (!limit) return;
        for (const [id, at] of this.lastInputAt) {
            if (id === LOCAL_LINK_ID || now - at <= limit) continue;
            console.warn(`[tournament] no input from ${id} for ${limit / 1000} s, dropping it from the duel`);
            this.disconnect(id);
        }
    }

    get humanCount() {
        return this.joined.size;
    }

    get spectatorCount() {
        return this.spectators.size;
    }
}

/** Drive a RoomHost from a timer. Returns a stop function. A failing tick is reported, not fatal. */
export const runRoomLoop = (
    host: RoomHost,
    onError: (err: unknown) => void = err => console.error('Room loop error:', err),
    clock: () => number = () => performance.now(),
): (() => void) => {
    let last = clock();
    const timer = setInterval(() => {
        const now = clock();
        try {
            host.update(now - last);
        } catch (err) {
            onError(err);
        }
        last = now;
    }, LOOP_INTERVAL_MS);
    return () => clearInterval(timer);
};
