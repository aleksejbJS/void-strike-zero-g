import { describe, it, expect } from 'vitest';
import { ClientSession } from './clientSession';
import { EmitterSocket } from './sessionSocket';
import { JoinAccepted } from './protocol';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { GameMode, Team } from '../../types';
import { presetBuild } from '../build/buildPresets';

class SilentSocket extends EmitterSocket {
    emit() {}
    disconnect() {}
}

// Only what setupWorld/applySnapshot touch: no real collision world is needed
const fakePhysics = () => ({
    bodies: new Map(), clear() {}, addPlatform() {}, addPlayer() {}, removeBody() {},
}) as unknown as MatterPhysicsEngine;

const callbacks = { onJoined() {}, onRejected() {}, onConnectionError() {}, onDisconnected() {}, onEvents() {} };

describe('client snapshots: builds from the host are checked before drawing', () => {
    it('unknown part ids fall back to the skin preset, valid fields are kept', () => {
        const hostile = { ...presetBuild('wolf'), helmet: 'x', visor: 'laser', tail: 'x', ears: 'antennae' };
        const remote = { ...createMockPlayer('r', Team.NONE), skinId: 'wolf', build: hostile as any };
        const me = createMockPlayer('me', Team.NONE);
        const info: JoinAccepted = {
            id: 'me', mode: GameMode.DEATHMATCH, map: 'arena' as any, platforms: [],
            snapshot: { ...createMockState(GameMode.DEATHMATCH), players: [me, remote], serverTime: Date.now() } as any,
        };
        const session = new ClientSession(new SilentSocket(), {} as any, fakePhysics(), callbacks);
        session.localId = 'me';
        const state = createMockState(GameMode.DEATHMATCH);

        session.setupWorld(state, info);

        const build = state.players.find(p => p.id === 'r')!.build!;
        const preset = presetBuild('wolf');
        expect(build.helmet).toBe(preset.helmet);
        expect(build.visor).toBe(preset.visor);
        expect(build.tail).toBe(preset.tail);
        expect(build.ears).toBe('antennae');
    });
});
