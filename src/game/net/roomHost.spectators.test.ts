import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, MapId } from '../../types';
import { gameEvents } from '../systems/events';
import { GameRoom } from './room';
import { RoomHost, PeerLink } from './roomHost';
import { MSG, SNAPSHOT_RATE, SPECTATOR_CAP } from './protocol';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' };
const input = { keys: {}, mouse: { x: 0, y: 0 }, mousePressed: true, hookPressed: false, sequence: 1 };
const SNAPSHOT_TICK_MS = 1000 / SNAPSHOT_RATE + 1;

const recorder = (id: string) => {
    const sent: { event: string; data: any }[] = [];
    const link: PeerLink = { id, send: (event, data) => sent.push({ event, data }) };
    return { link, sent, events: () => sent.map(m => m.event) };
};

const rooms: GameRoom[] = [];
// No bots: their AI emits random sounds/effects during the ticks, which made exact message lists flaky.
// Every event the tests rely on is emitted by the test itself.
const makeHost = () => {
    const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2, bots: 0 });
    rooms.push(room);
    return new RoomHost(room);
};
afterEach(() => {
    rooms.splice(0).forEach(r => r.dispose());
    vi.restoreAllMocks();
});

/** Connect a fresh link and send WATCH. */
const watcher = (host: RoomHost, id: string) => {
    const w = recorder(id);
    host.connect(w.link);
    host.message(id, MSG.WATCH, {});
    return w;
};

describe('RoomHost spectators', () => {
    it('answers WATCH with the world, then streams snapshots, without adding an entity', () => {
        const host = makeHost();
        expect(host.room.state.players).toHaveLength(0);
        const w = watcher(host, 'w1');

        expect(w.sent).toHaveLength(1);
        expect(w.sent[0].event).toBe(MSG.WATCHING);
        expect(w.sent[0].data).toMatchObject({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT });
        expect(w.sent[0].data.platforms).toBe(host.room.state.platforms);
        expect(w.sent[0].data.snapshot.players).toBeDefined();
        expect(host.spectatorCount).toBe(1);

        host.update(SNAPSHOT_TICK_MS);
        expect(w.events()).toEqual([MSG.WATCHING, MSG.SNAPSHOT]);
        expect(host.room.state.players).toHaveLength(0);
        expect(host.room.state.players.some(p => p.id === 'w1')).toBe(false);
    });

    it('sends events and snapshots to spectators and joined players alike', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);
        const w = watcher(host, 'w1');

        const sound = { type: 'SOUND', sound: 'boom' } as const;
        gameEvents.emit(sound);
        host.update(SNAPSHOT_TICK_MS);

        const eventMsgs = w.sent.filter(m => m.event === MSG.EVENTS);
        expect(eventMsgs).toHaveLength(1);
        expect(eventMsgs[0].data).toContainEqual(sound);
        expect(w.events().at(-1)).toBe(MSG.SNAPSHOT);
        expect(a.sent.filter(m => m.event === MSG.EVENTS)).toHaveLength(1);
        expect(a.events().at(-1)).toBe(MSG.SNAPSHOT);
    });

    it('rejects the watcher past the cap with spectators_full', () => {
        const host = makeHost();
        for (let i = 0; i < SPECTATOR_CAP; i++) watcher(host, `w${i}`);
        expect(host.spectatorCount).toBe(SPECTATOR_CAP);

        const late = watcher(host, 'late');
        expect(late.sent).toEqual([{ event: MSG.JOIN_REJECTED, data: { reason: 'spectators_full' } }]);
        expect(host.spectatorCount).toBe(SPECTATOR_CAP);

        host.update(SNAPSHOT_TICK_MS);
        expect(late.events()).toEqual([MSG.JOIN_REJECTED]);
    });

    it('keeps the spectator cap at 6', () => {
        expect(SPECTATOR_CAP).toBe(6);
    });

    it('ignores INPUT from a spectator', () => {
        const host = makeHost();
        const pushInput = vi.spyOn(host.room, 'pushInput');
        watcher(host, 'w1');
        host.message('w1', MSG.INPUT, input);
        expect(pushInput).not.toHaveBeenCalled();
        expect(host.room.state.players.some(p => p.id === 'w1')).toBe(false);
    });

    it('frees the slot when a spectator disconnects', () => {
        const host = makeHost();
        for (let i = 0; i < SPECTATOR_CAP; i++) watcher(host, `w${i}`);
        host.disconnect('w0');
        expect(host.spectatorCount).toBe(SPECTATOR_CAP - 1);

        const next = watcher(host, 'next');
        expect(next.events()).toEqual([MSG.WATCHING]);
        expect(host.spectatorCount).toBe(SPECTATOR_CAP);
    });

    it('stops sending to a spectator that disconnected', () => {
        const host = makeHost();
        const w = watcher(host, 'w1');
        host.disconnect('w1');
        host.update(SNAPSHOT_TICK_MS);
        expect(w.events()).toEqual([MSG.WATCHING]);
    });

    it('does not count spectators as humans', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);
        watcher(host, 'w1');
        watcher(host, 'w2');
        expect(host.humanCount).toBe(1);
        expect(host.spectatorCount).toBe(2);
    });

    it('does not take a player slot: a full room still seats spectators', () => {
        const host = makeHost();
        for (const id of ['a', 'b']) {
            host.connect(recorder(id).link);
            host.message(id, MSG.JOIN, join);
        }
        const w = watcher(host, 'w1');
        expect(w.events()).toEqual([MSG.WATCHING]);
    });

    it('ignores WATCH from a link that already joined as a player', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);
        host.message('a', MSG.WATCH, {});

        expect(a.events()).toEqual([MSG.JOINED]);
        expect(host.spectatorCount).toBe(0);
        host.update(SNAPSHOT_TICK_MS);
        expect(a.events().filter(e => e === MSG.SNAPSHOT)).toHaveLength(1); // not duplicated
    });

    it('ignores a repeated WATCH, even when the spectator list is full', () => {
        const host = makeHost();
        const first = watcher(host, 'w0');
        for (let i = 1; i < SPECTATOR_CAP; i++) watcher(host, `w${i}`);
        host.message('w0', MSG.WATCH, {});
        expect(first.events()).toEqual([MSG.WATCHING]);
        expect(host.spectatorCount).toBe(SPECTATOR_CAP);
    });

    it('does not let a spectator become a player by sending JOIN', () => {
        const host = makeHost();
        const w = watcher(host, 'w1');
        host.message('w1', MSG.JOIN, join);
        expect(w.sent.at(-1)).toEqual({ event: MSG.JOIN_REJECTED, data: { reason: 'already_joined' } });
        expect(host.room.state.players.some(p => p.id === 'w1')).toBe(false);
        expect(host.humanCount).toBe(0);
    });

    it('ignores WATCH from a link that was never connected', () => {
        const host = makeHost();
        host.message('ghost', MSG.WATCH, {});
        expect(host.spectatorCount).toBe(0);
    });
});
