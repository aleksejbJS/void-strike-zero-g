import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyEffectEvent, emitDeath } from './effects';
import { DEFAULT_BUILD } from '../build/buildParts';
import { presetBuild } from '../build/buildPresets';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

describe('DEATH builds', () => {
    it('a DEATH event with unknown part ids yields sanitized ragdoll builds', () => {
        const hostile = { ...DEFAULT_BUILD, helmet: 'x', visor: 'laser', tail: 'x', pattern: 'camo' };
        const death = {
            type: 'DEATH', x: 0, y: 0, color: '#fff', height: 40,
            parts: { head: '#fff', torso: '#fff', arm: '#fff', leg: '#fff', build: hostile },
        } as unknown as GameEvent;
        const display = createMockState(GameMode.DEATHMATCH);

        applyEffectEvent(display, death);

        expect(display.ragdollParts).toHaveLength(6);
        for (const part of display.ragdollParts) {
            expect(part.build).toEqual({ ...DEFAULT_BUILD, pattern: 'camo' });
        }
    });

    it('an entity without a build dies with its skin preset', () => {
        const p = { ...createMockPlayer('p', Team.NONE), skinId: 'wolf', build: undefined };
        emitDeath(p);
        const death = events.find(e => e.type === 'DEATH')!;
        expect(death.type === 'DEATH' && death.parts?.build).toEqual(presetBuild('wolf'));
    });
});
