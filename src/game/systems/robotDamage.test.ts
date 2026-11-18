import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { DEFAULT_BUILD } from '../build/buildParts';
import { gameEvents, GameEvent } from './events';
import { applyEffectEvent } from './effects';
import { emitHitEffect } from './robotHits';
import { OIL_DECAL, ROBOT_OIL, ROBOT_SPARK, isRobotEntity } from './robotDamage';
import { BleedDrips, StumpSparks } from '../render/fighter/fighterBleed';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const robot = () => { const p = createMockPlayer('r', Team.NONE); p.build = { ...DEFAULT_BUILD, body: 'robot' }; return p; };
const human = () => { const p = createMockPlayer('h', Team.NONE); p.build = { ...DEFAULT_BUILD, body: 'human' }; return p; };
const parts = (body: 'robot' | 'human') => ({ head: '#fff', torso: '#fff', arm: '#fff', leg: '#fff', build: { ...DEFAULT_BUILD, body } });

describe('robot victims spark and leak oil instead of bleeding', () => {
    it('knows a robot by its build, or by its preset when no build is stored', () => {
        expect(isRobotEntity(robot())).toBe(true);
        expect(isRobotEntity(human())).toBe(false);
        const preset = createMockPlayer('p', Team.NONE); preset.build = undefined; preset.skinId = 'base-robot';
        expect(isRobotEntity(preset)).toBe(true);
    });

    it('turns a hit on a robot into sparks and a few oil drops, and keeps red blood for everyone else', () => {
        emitHitEffect(robot(), 10, 20);
        expect(events).toEqual([
            { type: 'EFFECT', effect: 'spark', x: 10, y: 20, color: ROBOT_SPARK, count: 6 },
            { type: 'EFFECT', effect: 'blood', x: 10, y: 20, color: ROBOT_OIL, count: 3 },
        ]);
        events = [];
        emitHitEffect(human(), 10, 20);
        expect(events).toEqual([{ type: 'EFFECT', effect: 'blood', x: 10, y: 20, color: '#ef4444', count: 6 }]);
    });

    it('throws oil and sparks and leaves an oil puddle when a robot dies; a human still bleeds red', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 50, y: 60, color: '#3b82f6', height: 60, parts: parts('robot') } as GameEvent);
        const kinds = new Set(state.particles.map(p => `${p.type}:${p.color}`));
        expect(kinds.has(`blood:${ROBOT_OIL}`)).toBe(true);
        expect(kinds.has(`spark:${ROBOT_SPARK}`)).toBe(true);
        expect([...kinds].some(k => k.startsWith('blood:') && k !== `blood:${ROBOT_OIL}`)).toBe(false);
        expect(state.decals.at(-1)!.color).toBe(OIL_DECAL);
        const other = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(other, { type: 'DEATH', x: 50, y: 60, color: '#3b82f6', height: 60, parts: parts('human') } as GameEvent);
        expect(other.particles.every(p => p.type !== 'spark')).toBe(true);
        expect(other.decals.at(-1)!.color).toBe(0x7f1d1d);
    });

    it('throws oil and sparks from a robot\'s torn-off leg', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'LIMB', x: 50, y: 60, height: 60, facing: 1, parts: parts('robot') } as unknown as GameEvent);
        expect(state.particles.some(p => p.type === 'blood' && p.color === ROBOT_OIL)).toBe(true);
        expect(state.particles.some(p => p.type === 'spark' && p.color === ROBOT_SPARK)).toBe(true);
        expect(state.particles.some(p => p.type === 'blood' && p.color !== ROBOT_OIL)).toBe(false);
    });

    it('sparks from a robot stump every 0.6 to 1.2 seconds', () => {
        const state = createMockState(GameMode.DEATHMATCH), sparks = new StumpSparks();
        const bursts = (now: number) => { const before = state.particles.length; sparks.spawn(state, 0, 0, now); return state.particles.length > before; };
        expect(bursts(1000)).toBe(true);
        expect(bursts(1500)).toBe(false); // too soon: at least 0.6 s apart
        expect(bursts(2300)).toBe(true);  // at most 1.2 s apart
        expect(state.particles.every(p => p.type === 'spark' && p.color === ROBOT_SPARK)).toBe(true);
    });

    it('drips oil from a robot stump', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new BleedDrips().spawn(state, 0, 0, 1000, ROBOT_OIL);
        expect(state.particles[0].color).toBe(ROBOT_OIL);
    });
});
