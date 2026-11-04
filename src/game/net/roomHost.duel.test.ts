// RoomHost in a tournament duel room: a joined guest that stops sending input is dropped after idleKickMs (its
// PeerJS close can take 60–90 s), the host's own player never is; only such a room takes spectators; and a
// guest who comes back keeps the score it had. Other rooms behave exactly as before.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, MapId } from '../../types';
import { GameRoom, type RoomConfig } from './room';
import { RoomHost, PeerLink } from './roomHost';
import { MSG } from './protocol';
import { LOCAL_LINK_ID } from './hostProtocol';

const join = (name: string) => ({ name, color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' });
const input = (sequence: number) => ({ keys: {}, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence });

const recorder = (id: string) => {
    const sent: { event: string; data: any }[] = [];
    const link: PeerLink = { id, send: (event, data) => sent.push({ event, data }) };
    return { link, sent, events: () => sent.map(m => m.event) };
};

const DUEL: RoomConfig = { mode: GameMode.DUEL, map: MapId.PIT, maxPlayers: 2, bots: 0, restartMatches: false, spectators: true, idleKickMs: 8_000 };
const rooms: GameRoom[] = [];
const makeHost = (config: RoomConfig = DUEL) => {
    const room = new GameRoom(config);
    rooms.push(room);
    return new RoomHost(room);
};
const joinAs = (host: RoomHost, id: string, name: string, now: number) => {
    host.connect(recorder(id).link);
    host.message(id, MSG.JOIN, join(name), now);
};
const ids = (host: RoomHost) => host.room.state.players.map(p => p.id);

afterEach(() => {
    rooms.splice(0).forEach(r => r.dispose());
    vi.restoreAllMocks();
});

describe('RoomHost: idle guests in a duel room', () => {
    it('drops a joined guest without input for 8 s; input keeps it in', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const host = makeHost();
        joinAs(host, 'guest', 'Bea', 0);
        host.message('guest', MSG.INPUT, input(1), 5_000);
        host.update(1, 12_999);
        expect(ids(host)).toEqual(['guest']);
        host.update(1, 13_001);
        expect(ids(host)).toEqual([]);
        expect(host.humanCount).toBe(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'));
    });

    it('never drops the host\'s own player (its tab may sleep: no animation frames, no input)', () => {
        const host = makeHost();
        joinAs(host, LOCAL_LINK_ID, 'Host', 0);
        host.update(1, 60_000);
        expect(ids(host)).toEqual([LOCAL_LINK_ID]);
    });

    it('other rooms never drop anyone for silence', () => {
        const host = makeHost({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2, bots: 0 });
        joinAs(host, 'a', 'Alex', 0);
        host.update(1, 600_000);
        expect(ids(host)).toEqual(['a']);
    });

    it('a dropped guest that joins again (new link) gets its score back', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const host = makeHost();
        joinAs(host, LOCAL_LINK_ID, 'Host', 0);
        joinAs(host, 'guest-1', 'Bea', 0);
        host.room.state.players.find(p => p.id === 'guest-1')!.score = 6;
        host.update(1, 9_000);
        joinAs(host, 'guest-2', 'Bea', 10_000);
        expect(host.room.state.players.find(p => p.id === 'guest-2')?.score).toBe(6);
        joinAs(host, 'stranger', 'Max', 10_000); // the room is full again
        expect(ids(host)).not.toContain('stranger');
    });
});

describe('RoomHost: spectators only where the room allows them', () => {
    it('a room without the flag refuses WATCH', () => {
        const host = makeHost({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2, bots: 0 });
        const w = recorder('w');
        host.connect(w.link);
        host.message('w', MSG.WATCH, {});
        expect(w.sent).toEqual([{ event: MSG.JOIN_REJECTED, data: { reason: 'invalid' } }]);
        expect(host.spectatorCount).toBe(0);
    });

    it('a duel room accepts WATCH', () => {
        const host = makeHost();
        const w = recorder('w');
        host.connect(w.link);
        host.message('w', MSG.WATCH, {});
        expect(w.events()).toEqual([MSG.WATCHING]);
    });
});
