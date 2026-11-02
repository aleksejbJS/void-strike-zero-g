import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType, Particle, ParticleKind } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyEffectEvent } from './effects';
import { applyDamage, createExplosion, fireWeapon } from './combat';
import { DEFAULT_BUILD, FighterBuild } from '../build/buildParts';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

describe('simulation announces effects instead of drawing them', () => {
    it('damage and death become events, state stays free of cosmetics', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 100, y: 200 };
        p.health = 10;
        state.players.push(p);

        applyDamage(state, p, '', 50, { x: 1, y: 0 });

        expect(events).toContainEqual({ type: 'DAMAGE', x: 100, y: 160, amount: 50 });
        expect(events).toContainEqual(expect.objectContaining({ type: 'DEATH', x: 100, y: 200, color: p.color, height: p.height }));
        const death = events.find(e => e.type === 'DEATH');
        expect(death && 'parts' in death && death.parts?.torso).toBe(p.torsoColor || p.color);
        expect(state.particles).toHaveLength(0);
        expect(state.floatingTexts).toHaveLength(0);
        expect(state.ragdollParts).toHaveLength(0);
    });

    it('DEATH carries the build to every ragdoll part', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const build: FighterBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'ram', pattern: 'camo', badge: 'number', badgeNumber: 13 };
        const p = Object.assign(createMockPlayer('p1', Team.NONE), { build });
        state.players.push(p);
        applyDamage(state, p, '', 500, { x: 1, y: 0 });
        const death = events.find(e => e.type === 'DEATH')!;
        expect(death.type === 'DEATH' && death.parts?.build).toEqual(build);
        const display = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(display, death);
        expect(display.ragdollParts.map(part => part.build)).toEqual(Array(6).fill(build));
    });

    it('explosions and shots announce their effects', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.MACHINE_GUN);
        state.players.push(shooter);

        createExplosion(state, { x: 5, y: 6 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        fireWeapon(state, shooter, { x: 100, y: 0 });

        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'explosion' && e.x === 5)).toBe(true);
        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'shell')).toBe(true);
    });
});

describe('applyEffectEvent', () => {
    it('draws a death as blood, a decal and a ragdoll', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72 });
        expect(state.particles.length).toBe(40);
        expect(state.decals.length).toBe(1);
        expect(state.ragdollParts.length).toBe(6);
    });

    it('shows damage numbers and texts', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DAMAGE', x: 0, y: 0, amount: 25 });
        applyEffectEvent(state, { type: 'FLOAT_TEXT', x: 0, y: 0, text: '+1', color: '#00ff00' });
        expect(state.floatingTexts.map(t => t.text)).toEqual(['25', '+1']);
    });

    it('ignores non-visual events', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'SOUND', sound: 'hit' });
        expect(state.particles).toHaveLength(0);
    });
});

describe('compositions', () => {
    // Tally of how many particles of each kind a composition produced
    const count = (particles: Particle[]) => particles.reduce<Partial<Record<ParticleKind, number>>>((acc, p) => {
        const kind = p.type as ParticleKind;
        acc[kind] = (acc[kind] ?? 0) + 1;
        return acc;
    }, {});
    const ofKind = (particles: Particle[], kind: ParticleKind) => particles.filter(p => p.type === kind);
    const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
    // Random values: apply an event many times on a fresh state and gather every particle
    const gather = (event: GameEvent, times = 20) => {
        const all: Particle[] = [];
        for (let i = 0; i < times; i++) {
            const s = createMockState(GameMode.DEATHMATCH);
            applyEffectEvent(s, event);
            all.push(...s.particles);
        }
        return all;
    };

    it('an explosion is a flash, a fireball, a ring, embers and smoke', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 10, y: 20 });
        expect(count(state.particles)).toEqual({ flash: 1, fireball: 1, ring: 1, ember: 14, smoke: 6 });
        expect(state.particles.every(p => p.pos.x === 10 && p.pos.y === 20)).toBe(true);
        expect(ofKind(state.particles, 'flash')[0].size).toBe(40);
        expect(ofKind(state.particles, 'fireball')[0].size).toBe(12);
        expect(ofKind(state.particles, 'ring')[0].size).toBe(10);
    });

    it('the explosion flash, fireball and ring stay put', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 0, y: 0 });
        for (const kind of ['flash', 'fireball', 'ring'] as const) {
            expect(ofKind(state.particles, kind)[0].vel).toEqual({ x: 0, y: 0 });
        }
    });

    it('explosion embers fly up and out, smoke drifts slowly up', () => {
        const all = gather({ type: 'EFFECT', effect: 'explosion', x: 0, y: 0 });
        const embers = ofKind(all, 'ember');
        const smoke = ofKind(all, 'smoke');
        expect(embers.every(p => inRange(p.vel.x, -5, 5) && inRange(p.vel.y, -6, 1))).toBe(true);
        // Embers differ from each other (not one shared vector)
        expect(new Set(embers.map(p => p.vel.x)).size).toBeGreaterThan(1);
        expect(smoke.every(p => inRange(p.vel.x, -0.6, 0.6) && inRange(p.vel.y, -0.9, -0.3))).toBe(true);
        expect(smoke.every(p => inRange(p.size, 6, 12))).toBe(true);
        expect(new Set(smoke.map(p => p.size)).size).toBeGreaterThan(1);
    });

    it('an explosion skips its smoke when the particle budget is spent', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (let i = 0; i < 501; i++) applyEffectEvent(state, { type: 'EFFECT', effect: 'shell', x: 0, y: 0 });
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 0, y: 0 });
        expect(count(state.particles).smoke).toBeUndefined();
        expect(count(state.particles).fireball).toBe(1);
    });

    it('a wall spark is a coloured flash and streaks', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'spark', x: 5, y: 6, color: '#38bdf8' });
        expect(count(state.particles)).toEqual({ flash: 1, spark: 8 });
        const flash = ofKind(state.particles, 'flash')[0];
        expect(flash.color).toBe('#38bdf8');
        expect(flash.size).toBe(16);
        expect(flash.decay).toBe(0.07);
        expect(flash.vel).toEqual({ x: 0, y: 0 });
    });

    it('a spark event carries its own streak count, white by default', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'spark', x: 0, y: 0, count: 10 });
        expect(count(state.particles)).toEqual({ flash: 1, spark: 10 });
        expect(ofKind(state.particles, 'flash')[0].color).toBe('#ffffff');
    });

    it('spark streaks fly at 1-6 px per tick in all directions', () => {
        const sparks = ofKind(gather({ type: 'EFFECT', effect: 'spark', x: 0, y: 0 }), 'spark');
        const speeds = sparks.map(p => Math.hypot(p.vel.x, p.vel.y));
        expect(speeds.every(v => inRange(v, 1 - 1e-9, 6 + 1e-9))).toBe(true);
        expect(sparks.some(p => p.vel.x > 0) && sparks.some(p => p.vel.x < 0)).toBe(true);
        expect(sparks.some(p => p.vel.y > 0) && sparks.some(p => p.vel.y < 0)).toBe(true);
    });

    it('a fighter hit is droplets', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'blood', x: 5, y: 6 });
        expect(count(state.particles)).toEqual({ blood: 6 });
        expect(state.particles.every(p => p.color === '#ef4444')).toBe(true);
    });

    it('droplets are thrown up and sideways, each its own way', () => {
        const droplets = gather({ type: 'EFFECT', effect: 'blood', x: 0, y: 0, count: 6 });
        expect(droplets.every(p => inRange(p.vel.x, -3, 3) && inRange(p.vel.y, -4, 0))).toBe(true);
        expect(new Set(droplets.map(p => p.vel.y)).size).toBeGreaterThan(1);
    });

    it('a death bursts into 40 droplets in the fighter colour', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#123456', height: 72 });
        expect(count(state.particles)).toEqual({ blood: 40 });
        expect(state.particles.every(p => p.color === '#123456')).toBe(true);
        expect(state.particles.every(p => inRange(p.vel.x, -3, 3) && inRange(p.vel.y, -4, 0))).toBe(true);
    });

    it('respawn and shell keep their old looks', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'respawn', x: 0, y: 0 });
        expect(count(state.particles)).toEqual({ spark: 20 });
        state.particles = [];
        applyEffectEvent(state, { type: 'EFFECT', effect: 'shell', x: 0, y: 0 });
        expect(count(state.particles)).toEqual({ shell: 1 });
    });
});
