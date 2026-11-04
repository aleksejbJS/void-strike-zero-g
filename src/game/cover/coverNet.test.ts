import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, MapId } from '../../types';
import { GameRoom } from '../net/room';
import { RoomHost } from '../net/roomHost';
import { ClientSession } from '../net/clientSession';
import { EmitterSocket } from '../net/sessionSocket';
import { MSG, JoinAccepted, buildSnapshot } from '../net/protocol';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { DEFAULT_BUILD } from '../build/buildParts';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { Team } from '../../types';
import { applyCoverStatus, coverStatusOf, knownCover } from './coverNet';
import type { Cover } from './coverTypes';
import { piece, stateWithCover } from './coverTestKit';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic', build: DEFAULT_BUILD };
const controls = { keys: {}, aim: { x: 0, y: 0 }, mousePressed: false, hookPressed: false };
const callbacks = { onJoined() {}, onRejected() {}, onConnectionError() {}, onDisconnected() {}, onEvents() {} };

describe('coverStatusOf', () => {
    it('snapshot carries hp and returnsAt only', () => {
        const lit = { ...piece('barrel', 'barrel', 300, 400, 40), fuseAt: 9000, creditId: 'p1' };
        const gone = { ...piece('crate', 'wood', 100, 400, 0), returnsAt: 35000 };
        const whole = piece('glass', 'glass', 200, 400);

        const state = stateWithCover(lit, gone, whole);
        const sent = buildSnapshot(state, 1).coverStatus;

        expect(sent).toStrictEqual([{ id: 'barrel', hp: 40 }, { id: 'crate', hp: 0, returnsAt: 35000 }, { id: 'glass', hp: 60 }]);
        expect(coverStatusOf(state.cover!)).toStrictEqual(sent);
    });

    it('an empty or missing layout gives an empty list', () => {
        expect(coverStatusOf([])).toEqual([]);
        expect(buildSnapshot(createMockState(GameMode.DEATHMATCH), 1).coverStatus).toEqual([]);
    });
});

describe('applyCoverStatus', () => {
    it('writes hp and returnsAt by id, and clears returnsAt when a piece is back', () => {
        const a = { ...piece('a', 'wood', 0, 0, 0), returnsAt: 500 };
        const b = piece('b', 'wood', 0, 0);
        applyCoverStatus([a, b], [{ id: 'a', hp: 150 }, { id: 'b', hp: 0, returnsAt: 900 }]);
        expect(a.hp).toBe(150);
        expect(a.returnsAt).toBeUndefined();
        expect(b.hp).toBe(0);
        expect(b.returnsAt).toBe(900);
    });

    it('unknown ids are ignored', () => {
        const a = piece('a', 'wood', 0, 0);
        expect(() => applyCoverStatus([a], [{ id: 'ghost', hp: 0 }])).not.toThrow();
        expect(a.hp).toBe(150);
    });

    it('a snapshot without a status leaves the cover as it is', () => {
        const a = { ...piece('a', 'wood', 0, 0, 20), returnsAt: 7 };
        applyCoverStatus([a], undefined);
        expect(a).toMatchObject({ hp: 20, returnsAt: 7 });
    });

    it('does not touch what the server keeps to itself', () => {
        const a = { ...piece('a', 'barrel', 0, 0), fuseAt: 5, creditId: 'p1' };
        applyCoverStatus([a], [{ id: 'a', hp: 10 }]);
        expect(a).toMatchObject({ fuseAt: 5, creditId: 'p1' });
    });
});

describe('knownCover', () => {
    it('drops pieces of a kind this build does not know (a newer host)', () => {
        const spikes = { id: 's', kind: 'spikes', pos: { x: 0, y: 0 }, hp: 10 } as unknown as Cover;
        const crate = piece('c', 'wood', 0, 0);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(knownCover([spikes, crate])).toEqual([crate]);
        expect(warn).toHaveBeenCalledOnce();
        expect(knownCover(undefined)).toEqual([]);
        expect(knownCover([crate])).toEqual([crate]);
        expect(warn).toHaveBeenCalledOnce(); // nothing left out, nothing to say
        warn.mockRestore();
    });
});

/** A client wired to a room through the same message flow as a real link; the wire is simulated with structuredClone. */
class WireSocket extends EmitterSocket {
    host!: RoomHost;
    emit(event: string, data?: unknown) { this.host.message('me', event, structuredClone(data)); }
    disconnect() {}
    deliver(event: string, data?: unknown) { this.dispatch(event, data); }
}

/** A socket with nobody on the other end. */
class SilentSocket extends EmitterSocket {
    emit() {}
    disconnect() {}
}

const rooms: GameRoom[] = [];
afterEach(() => rooms.splice(0).forEach(r => r.dispose()));

const connect = (room: GameRoom) => {
    const socket = new WireSocket();
    socket.host = new RoomHost(room);
    socket.host.connect({ id: 'me', send: (event, data) => socket.deliver(event, structuredClone(data)) });
    const physics = new MatterPhysicsEngine();
    let info: JoinAccepted | undefined;
    const session = new ClientSession(socket, join, physics, { ...callbacks, onJoined: i => { info = i; } });
    const state = createMockState(GameMode.DEATHMATCH);
    socket.deliver('connect');
    session.setupWorld(state, info!);
    return { socket, physics, session, state, info: info! };
};

describe('cover over the wire', () => {
    it('join mid-match keeps broken cover broken', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4, bots: 0 });
        rooms.push(room);
        const [broken, whole] = room.state.cover!;
        broken.hp = 0;
        broken.returnsAt = Date.now() + 30000;
        room.tick();

        const { physics, session, state } = connect(room);
        session.tick(state, controls, 0);

        const mine = state.cover!.find(c => c.id === broken.id)!;
        expect(state.cover!.map(c => c.id)).toEqual(room.state.cover!.map(c => c.id));
        expect(mine.hp).toBe(0);
        expect(Math.abs(mine.returnsAt! - broken.returnsAt)).toBeLessThan(1000);
        expect(physics.bodies.has(broken.id)).toBe(false);
        expect(physics.bodies.has(whole.id)).toBe(true);
    });

    it('the client keeps its own copy: the room is not touched by what it applies', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4, bots: 0 });
        rooms.push(room);
        const { state, info } = connect(room);
        expect(info.cover).not.toBe(room.state.cover);
        state.cover![0].hp = 0;
        expect(room.state.cover![0].hp).toBeGreaterThan(0);
    });

    it('a broken piece mends on the client when the server restores it', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4, bots: 0 });
        rooms.push(room);
        const { socket, physics, session, state } = connect(room);
        const target = room.state.cover![0];
        session.tick(state, controls, 0);

        target.hp = 0;
        target.returnsAt = Date.now() + 30000;
        socket.deliver(MSG.SNAPSHOT, structuredClone(room.snapshot(Date.now())));
        session.tick(state, controls, 1);
        expect(state.cover![0].hp).toBe(0);
        expect(physics.bodies.has(target.id)).toBe(false);

        target.hp = 150;
        target.returnsAt = undefined;
        socket.deliver(MSG.SNAPSHOT, structuredClone(room.snapshot(Date.now())));
        session.tick(state, controls, 2);
        expect(state.cover![0].hp).toBe(150);
        expect(state.cover![0].returnsAt).toBeUndefined();
        expect(physics.bodies.has(target.id)).toBe(true);
    });

    it('coverStatus is applied to the cover and never copied onto the game state', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4, bots: 0 });
        rooms.push(room);
        const { state } = connect(room);
        expect('coverStatus' in state).toBe(false);
    });

    it('host without cover: the client has an empty list and keeps working', () => {
        const physics = new MatterPhysicsEngine();
        const session = new ClientSession(new SilentSocket(), join, physics, callbacks);
        const state = createMockState(GameMode.DEATHMATCH);
        state.cover = [piece('stale', 'wood', 0, 0)]; // whatever a previous world left behind
        const me = { ...createMockPlayer('me', Team.NONE), pos: { x: 100, y: 100 } };
        const { cover: _cover, ...old } = createMockState(GameMode.DEATHMATCH);
        const info: JoinAccepted = { id: 'me', mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, platforms: [], snapshot: { ...old, players: [me], serverTime: Date.now() } as any };

        session.localId = 'me';
        expect(() => session.setupWorld(state, info)).not.toThrow();
        expect(state.cover).toEqual([]);
        expect(() => session.tick(state, controls, 0)).not.toThrow();
    });
});
