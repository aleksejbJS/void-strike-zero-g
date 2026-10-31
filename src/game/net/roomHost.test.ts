import { describe, it, expect, afterEach } from 'vitest';
import { GameMode, MapId } from '../../types';
import { GameRoom } from './room';
import { RoomHost, PeerLink } from './roomHost';
import { MSG, SNAPSHOT_RATE } from './protocol';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' };

const recorder = (id: string) => {
    const sent: { event: string; data: any }[] = [];
    const link: PeerLink = { id, send: (event, data) => sent.push({ event, data }) };
    return { link, sent, events: () => sent.map(m => m.event) };
};

const rooms: GameRoom[] = [];
const makeHost = () => {
    const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2 });
    rooms.push(room);
    return new RoomHost(room);
};
afterEach(() => rooms.splice(0).forEach(r => r.dispose()));

describe('RoomHost (transport-agnostic)', () => {
    it('joins, then sends snapshots only to joined links', () => {
        const host = makeHost();
        const a = recorder('a');
        const lurker = recorder('lurker');
        host.connect(a.link);
        host.connect(lurker.link);
        host.message('a', MSG.JOIN, join);
        expect(a.events()).toEqual([MSG.JOINED]);

        host.update(1000 / SNAPSHOT_RATE + 1);
        expect(a.events()).toContain(MSG.SNAPSHOT);
        expect(lurker.sent).toHaveLength(0);
    });

    it('rejects garbage and ignores input from links that never joined', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, { name: 42 });
        expect(a.sent[0]).toEqual({ event: MSG.JOIN_REJECTED, data: { reason: 'invalid' } });
        host.message('a', MSG.INPUT, { keys: {}, mouse: { x: 0, y: 0 }, mousePressed: true, hookPressed: false, sequence: 1 });
        host.message('a', 'somethingElse', { evil: true });
        expect(host.room.state.players.some(p => p.id === 'a')).toBe(false);
    });

    it('removes the player when the link disconnects', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);
        host.disconnect('a');
        expect(host.room.state.players.some(p => p.id === 'a')).toBe(false);
        expect(host.humanCount).toBe(0);
    });
});
