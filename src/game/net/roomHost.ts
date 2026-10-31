// Connection handling around a GameRoom, independent of the transport:
// the Node server feeds it socket.io sockets, a browser host feeds it WebRTC peers.

import { GameRoom } from './room';
import { FixedStepper } from '../systems/fixedStep';
import { validateJoin, validateInput } from './validation';
import { MSG, SNAPSHOT_RATE, JoinAccepted, JoinRejected } from './protocol';

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
    private readonly stepper = new FixedStepper();
    private sinceSnapshot = 0;

    constructor(readonly room: GameRoom) {}

    connect(link: PeerLink) {
        this.links.set(link.id, link);
    }

    disconnect(id: string) {
        this.links.delete(id);
        if (this.joined.delete(id)) this.room.leave(id);
    }

    /** A message from a client. Everything is validated — clients may send anything. */
    message(id: string, event: string, data: unknown, now = Date.now()) {
        const link = this.links.get(id);
        if (!link) return;

        if (event === MSG.JOIN) {
            const reject = (reason: JoinRejected['reason']) => link.send(MSG.JOIN_REJECTED, { reason } satisfies JoinRejected);
            if (this.joined.has(id)) return reject('already_joined');
            const req = validateJoin(data);
            if (!req) return reject('invalid');
            const result = this.room.join(id, req);
            if (result.ok === false) return reject(result.reason);

            this.joined.add(id);
            const accepted: JoinAccepted = {
                id,
                mode: this.room.state.mode,
                map: this.room.state.currentMap,
                platforms: this.room.state.platforms,
                snapshot: this.room.snapshot(now),
            };
            link.send(MSG.JOINED, accepted);
        } else if (event === MSG.INPUT && this.joined.has(id)) {
            const input = validateInput(data, now);
            if (input) this.room.pushInput(id, input);
        }
    }

    /** Advance by `elapsedMs` of real time; sends events and snapshots to joined clients. */
    update(elapsedMs: number, now = Date.now()) {
        this.stepper.advance(elapsedMs, () => this.room.tick());

        this.sinceSnapshot += elapsedMs;
        if (this.sinceSnapshot < SNAPSHOT_INTERVAL_MS) return;
        this.sinceSnapshot = 0;

        const events = this.room.drainEvents();
        const snapshot = this.room.snapshot(now);
        for (const id of this.joined) {
            const link = this.links.get(id);
            if (!link) continue;
            if (events.length) link.send(MSG.EVENTS, events);
            link.send(MSG.SNAPSHOT, snapshot);
        }
    }

    get humanCount() {
        return this.joined.size;
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
