import { describe, it, expect } from 'vitest';
import { ClientSession } from './clientSession';
import { EmitterSocket } from './sessionSocket';
import { JoinAccepted, MSG } from './protocol';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { Entity, GameMode, Team } from '../../types';

class TestSocket extends EmitterSocket {
    emit() {}
    disconnect() {}
    deliver(event: string, data: unknown) { this.dispatch(event, data); }
}

const callbacks = { onJoined() {}, onRejected() {}, onConnectionError() {}, onDisconnected() {}, onEvents() {} };
const controls = { keys: {}, aim: { x: 0, y: 0 }, mousePressed: false, hookPressed: false };

const me = (x: number, dead = false): Entity => ({ ...createMockPlayer('me', Team.NONE), pos: { x, y: 100 }, dead });
const snapshot = (player: Entity) => ({ ...createMockState(GameMode.DEATHMATCH), players: [player], serverTime: Date.now() }) as any;

describe('client prediction after a respawn', () => {
    it('plays on from the respawn point, not from where the player died', () => {
        const socket = new TestSocket();
        const session = new ClientSession(socket, {} as any, new MatterPhysicsEngine(), callbacks);
        const state = createMockState(GameMode.DEATHMATCH);
        const info: JoinAccepted = { id: 'me', mode: GameMode.DEATHMATCH, map: 'arena' as any, platforms: [], snapshot: snapshot(me(100)) };
        session.localId = 'me';
        session.setupWorld(state, info);

        for (let i = 0; i < 5; i++) session.tick(state, controls, i);
        socket.deliver(MSG.SNAPSHOT, snapshot(me(100, true)));
        for (let i = 0; i < 5; i++) session.tick(state, controls, i);
        socket.deliver(MSG.SNAPSHOT, snapshot(me(2000)));
        session.tick(state, controls, 0);

        const local = state.players.find(p => p.id === 'me')!;
        expect(Math.abs(local.pos.x - 2000)).toBeLessThan(50);
    });
});
