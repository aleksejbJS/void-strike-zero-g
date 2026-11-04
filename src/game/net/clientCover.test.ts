import { describe, it, expect, vi } from 'vitest';
import { ClientSession } from './clientSession';
import { EmitterSocket } from './sessionSocket';
import { JoinAccepted, MSG } from './protocol';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { GameMode, Team } from '../../types';

class TestSocket extends EmitterSocket {
    emit() {}
    disconnect() {}
    deliver(event: string, data: unknown) { this.dispatch(event, data); }
}

const callbacks = { onJoined() {}, onRejected() {}, onConnectionError() {}, onDisconnected() {}, onEvents() {} };
const controls = { keys: {}, aim: { x: 0, y: 0 }, mousePressed: false, hookPressed: false };
const snapshot = () => ({ ...createMockState(GameMode.DEATHMATCH), players: [{ ...createMockPlayer('me', Team.NONE), pos: { x: 100, y: 100 } }], serverTime: Date.now() }) as any;

describe('client prediction with cover', () => {
    const start = () => {
        const socket = new TestSocket();
        const physics = new MatterPhysicsEngine();
        const session = new ClientSession(socket, {} as any, physics, callbacks);
        const state = createMockState(GameMode.DEATHMATCH);
        const info: JoinAccepted = { id: 'me', mode: GameMode.DEATHMATCH, map: 'arena' as any, platforms: [], snapshot: snapshot() };
        session.localId = 'me';
        session.setupWorld(state, info);
        state.cover = [{ id: 'crate', kind: 'wood', pos: { x: 500, y: 400 }, hp: 150 }];
        return { socket, physics, session, state };
    };

    it('predicts against intact cover and keeps its body when a snapshot arrives', () => {
        const { socket, physics, session, state } = start();
        session.tick(state, controls, 0);
        const body = physics.bodies.get('crate');
        expect(body).toBeDefined();

        socket.deliver(MSG.SNAPSHOT, snapshot());
        session.tick(state, controls, 1);

        expect(physics.bodies.get('crate')).toBe(body); // kept, not rebuilt
    });

    it('drops the body when the piece breaks', () => {
        const { physics, session, state } = start();
        session.tick(state, controls, 0);
        state.cover![0].hp = 0;
        session.tick(state, controls, 1);
        expect(physics.bodies.has('crate')).toBe(false);
    });
});

describe('client with a layout from a newer host', () => {
    it('leaves out pieces of a kind it does not know instead of crashing', () => {
        const physics = new MatterPhysicsEngine();
        const session = new ClientSession(new TestSocket(), {} as any, physics, callbacks);
        const state = createMockState(GameMode.DEATHMATCH);
        const cover = [{ id: 'spikes', kind: 'spikes', pos: { x: 300, y: 400 }, hp: 10 }, { id: 'crate', kind: 'wood', pos: { x: 500, y: 400 }, hp: 150 }];
        const info = { id: 'me', mode: GameMode.DEATHMATCH, map: 'arena', platforms: [], cover, snapshot: snapshot() } as unknown as JoinAccepted;
        session.localId = 'me';
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        session.setupWorld(state, info);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
        expect(() => session.tick(state, controls, 0)).not.toThrow();
        expect(state.cover!.map(c => c.id)).toEqual(['crate']);
        expect(physics.bodies.has('crate')).toBe(true);
    });
});
