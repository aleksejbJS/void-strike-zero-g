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

describe('RoomHost cover', () => {
    it('sends the cover layout with the world, as copies the client may change', () => {
        const host = makeHost();
        host.room.state.cover![0].hp = 0;
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);

        const accepted = a.sent[0].data;
        expect(accepted.cover.map((c: any) => c.id)).toEqual(host.room.state.cover!.map(c => c.id));
        expect(accepted.cover).not.toBe(host.room.state.cover);
        expect(accepted.cover[0]).not.toBe(host.room.state.cover![0]);
        expect(accepted.snapshot.coverStatus[0]).toEqual({ id: host.room.state.cover![0].id, hp: 0 });
    });

    it('streams cover status in every snapshot', () => {
        const host = makeHost();
        const a = recorder('a');
        host.connect(a.link);
        host.message('a', MSG.JOIN, join);
        host.room.state.cover![1].hp = 5;

        host.update(1000 / SNAPSHOT_RATE + 1);
        const snap = a.sent.filter(m => m.event === MSG.SNAPSHOT).pop()!.data;
        expect(snap.coverStatus).toHaveLength(host.room.state.cover!.length);
        expect(snap.coverStatus[1]).toEqual({ id: host.room.state.cover![1].id, hp: 5 });
    });

    it('a spectator gets the layout too', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2, bots: 0, spectators: true });
        rooms.push(room);
        const host = new RoomHost(room);
        const w = recorder('w');
        host.connect(w.link);
        host.message('w', MSG.WATCH, {});

        expect(w.sent[0].event).toBe(MSG.WATCHING);
        expect(w.sent[0].data.cover.map((c: any) => c.id)).toEqual(room.state.cover!.map(c => c.id));
        expect(w.sent[0].data.cover).not.toBe(room.state.cover);
    });
});
