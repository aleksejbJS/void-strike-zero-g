import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType, Particle, ParticleKind } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyEffectEvent } from './effects';
import { applyDamage, fireWeapon } from './combat';
import { createExplosion } from './explosion';
import { DEFAULT_BUILD, FighterBuild } from '../build/buildParts';
import { speedOf } from './ragdoll/corpseStep';
import { updateCorpses } from './ragdoll/corpses';
import { piecesOf } from '../render/ragdoll/corpsePose';
import { sanitizeBuild } from '../build/sanitizeBuild';

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
        expect(state.corpses).toHaveLength(0);
    });

    it('DEATH carries the build to the corpse', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const build: FighterBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'ram', pattern: 'camo', badge: 'number', badgeNumber: 13 };
        const p = Object.assign(createMockPlayer('p1', Team.NONE), { build });
        state.players.push(p);
        applyDamage(state, p, '', 500, { x: 1, y: 0 });
        const death = events.find(e => e.type === 'DEATH')!;
        expect(death.type === 'DEATH' && death.parts?.build).toEqual(build);
        const display = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(display, death);
        expect(display.corpses).toHaveLength(1);
        expect(display.corpses[0].colors?.build).toEqual(build);
    });

    it('explosions and shots announce their effects', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.MACHINE_GUN);
        state.players.push(shooter);

        createExplosion(state, { x: 5, y: 6 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        fireWeapon(state, shooter, { x: 100, y: 0 });

        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'explosion' && e.x === 5 && e.size === 1)).toBe(true);
        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'shell')).toBe(true);
    });
});

describe('explosion size', () => {
    it('a grenade blast is drawn a bit smaller than a rocket blast', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        createExplosion(state, { x: 0, y: 0 }, 's', 150, WeaponType.GRENADE_LAUNCHER);
        const blast = events.find(e => e.type === 'EFFECT' && e.effect === 'explosion');
        expect(blast?.type === 'EFFECT' && blast.size).toBeCloseTo(0.85);
    });
});

describe('applyEffectEvent', () => {
    it('draws a death as blood, a decal and a corpse', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72, vel: { x: 0, y: 0 }, facing: 1 });
        expect(state.particles.length).toBe(40);
        expect(state.decals.length).toBe(1);
        expect(state.corpses.length).toBe(1);
    });

    it('DEATH without kind falls', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72, vel: { x: 0, y: 0 }, facing: 1 });
        expect(state.corpses).toHaveLength(1);
        expect(state.corpses[0].kind).toBe('fall');
        // A fall only slumps: the body is not thrown (the dropped gun flips out on its own)
        const body = Object.entries(state.corpses[0].points).filter(([id]) => !id.startsWith('gun')).map(([, p]) => p);
        expect(Math.max(...body.map(p => Math.hypot(p.x - p.px, p.y - p.py)))).toBeLessThan(2.5);
    });

    it('DEATH from an older host (no vel, no facing, no kind) still leaves a corpse', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const old = { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72 } as unknown as GameEvent;
        applyEffectEvent(state, old);
        expect(state.corpses).toHaveLength(1);
        const points = Object.values(state.corpses[0].points);
        expect(points.every(p => [p.x, p.y, p.px, p.py].every(Number.isFinite))).toBe(true);
    });

    it('blood flies away from the hit', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, {
            type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72, vel: { x: 0, y: 0 }, facing: 1,
            kind: 'fall', from: { x: 60, y: 20 },
        });
        const blood = state.particles.filter(p => p.type === 'blood');
        expect(blood).toHaveLength(40);
        expect(blood.reduce((sum, p) => sum + p.vel.x, 0) / blood.length).toBeLessThan(0);
    });

    it('an explosion pushes the corpses near it', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72, vel: { x: 0, y: 0 }, facing: 1 });
        updateCorpses(state); // lying since an earlier tick: a corpse born this tick is not pushed
        const corpse = state.corpses[0];
        const before = speedOf(corpse);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: corpse.points.hip.x + 30, y: corpse.points.hip.y });
        expect(speedOf(corpse)).toBeGreaterThan(before + 1);
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

describe('a torn-off leg (LIMB)', () => {
    const limb = (extra: Partial<Extract<GameEvent, { type: 'LIMB' }>> = {}): GameEvent => ({
        type: 'LIMB', x: 100, y: 300, facing: 1, vel: { x: 0, y: 0 }, from: { x: 0, y: 260 }, ...extra,
    });

    it('adds one leg piece and a blood burst at the hip', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, limb());
        expect(state.corpses).toHaveLength(1);
        expect(piecesOf(state.corpses[0]).map(p => p.part)).toEqual(['leg-back']);
        const blood = state.particles.filter(p => p.type === 'blood');
        expect(blood.length).toBeGreaterThan(0);
        expect(state.particles).toHaveLength(blood.length);
        const hip = state.corpses[0].points.hip;
        expect(blood.every(p => Math.abs(p.pos.x - hip.x) < 1 && Math.abs(p.pos.y - hip.y) < 1)).toBe(true);
        expect(state.decals).toHaveLength(0); // a wound is not a death
    });

    it('the blood flies away from the beam', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, limb({ from: { x: 400, y: 260 } }));
        const blood = state.particles.filter(p => p.type === 'blood');
        expect(blood.reduce((sum, p) => sum + p.vel.x, 0) / blood.length).toBeLessThan(0);
    });

    it('the build comes from the host: unknown part ids are made valid before they are drawn', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const junk = { ...DEFAULT_BUILD, helmet: 'no-such-helmet' } as unknown as FighterBuild;
        applyEffectEvent(state, limb({ parts: { head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#475569', build: junk } }));
        expect(state.corpses[0].colors?.build).toEqual(sanitizeBuild(junk));
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

    it('an explosion is a flash, a lumpy fireball, a ring, debris, embers, soot and smoke', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 10, y: 20 });
        expect(count(state.particles)).toEqual({ flash: 1, fireball: 4, ring: 1, debris: 10, ember: 10, soot: 7, smoke: 3 });
        expect(ofKind(state.particles, 'flash')[0].size).toBe(52);
        expect(ofKind(state.particles, 'fireball')[0].size).toBe(16);
        expect(ofKind(state.particles, 'ring')[0].size).toBe(12);
        // Billows and soot sit around the blast, everything else starts on it
        const billows = ofKind(state.particles, 'fireball').slice(1);
        expect(billows.every(p => inRange(p.pos.x, -14, 34) && inRange(p.pos.y, 0, 28))).toBe(true);
        expect(ofKind(state.particles, 'debris').every(p => p.pos.x === 10 && p.pos.y === 20)).toBe(true);
    });

    it('a bigger blast draws everything bigger', () => {
        const small = createMockState(GameMode.DEATHMATCH);
        const big = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(small, { type: 'EFFECT', effect: 'explosion', x: 0, y: 0, size: 0.85 });
        applyEffectEvent(big, { type: 'EFFECT', effect: 'explosion', x: 0, y: 0, size: 1 });
        expect(ofKind(small.particles, 'flash')[0].size).toBeLessThan(ofKind(big.particles, 'flash')[0].size);
        expect(ofKind(small.particles, 'fireball')[0].size).toBeLessThan(ofKind(big.particles, 'fireball')[0].size);
    });

    it('the explosion flash, fireball and ring stay put', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 0, y: 0 });
        for (const kind of ['flash', 'fireball', 'ring'] as const) {
            expect(ofKind(state.particles, kind).every(p => p.vel.x === 0 && p.vel.y === 0)).toBe(true);
        }
    });

    it('explosion debris flies fast and mostly up, embers fly out, soot and smoke drift slowly up', () => {
        const all = gather({ type: 'EFFECT', effect: 'explosion', x: 0, y: 0 });
        const debris = ofKind(all, 'debris');
        expect(debris.every(p => inRange(Math.hypot(p.vel.x, p.vel.y), 5, 9.5))).toBe(true);
        expect(debris.filter(p => p.vel.y < 0).length).toBeGreaterThan(debris.length * 0.6); // ~3 in 4 go up
        expect(ofKind(all, 'soot').every(p => inRange(p.vel.y, -0.7, -0.2))).toBe(true);
        const embers = ofKind(all, 'ember');
        const smoke = ofKind(all, 'smoke');
        expect(embers.every(p => inRange(p.vel.x, -6, 6) && inRange(p.vel.y, -7, 1))).toBe(true);
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
        expect(count(state.particles).soot).toBeUndefined();
        expect(count(state.particles).fireball).toBe(4);
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
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#123456', height: 72, vel: { x: 0, y: 0 }, facing: 1 });
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
