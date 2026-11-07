import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameMode, Platform, WeaponType } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent } from '../events';
import { Corpse, CorpsePointId, createCorpse } from './corpseBody';
import { MAX_SPEED, stepCorpse } from './corpseStep';
import { launchCorpse } from './corpseLaunch';
import { addCorpse, MAX_CORPSES, updateCorpses } from './corpses';

const TOP = 500;
const FLOOR: Platform = { id: 'floor', x: -2000, y: TOP, w: 4000, h: 40, color: '#000' };

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 0, y: TOP, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1, ...extra,
});

const dist = (c: Corpse, a: CorpsePointId, b: CorpsePointId) =>
    Math.hypot(c.points[a].x - c.points[b].x, c.points[a].y - c.points[b].y);

const linkLen = (c: Corpse, a: CorpsePointId, b: CorpsePointId) =>
    c.links.find(l => !l.min && ((l.a === a && l.b === b) || (l.a === b && l.b === a)))!.len;

const run = (c: Corpse, ticks: number, platforms: Platform[] = [FLOOR], each?: () => void) => {
    for (let i = 0; i < ticks; i++) { stepCorpse(c, platforms); each?.(); }
};

/** A corpse launched by `kind` on the floor; `from` relative to its hip. */
const launched = (kind: DeathEvent['kind'], from?: { dx: number; dy: number }) => {
    const c = createCorpse(death({ kind }));
    const hip = c.points.hip;
    launchCorpse(c, from && { x: hip.x + from.dx, y: hip.y + from.dy }, { x: 0, y: 0 });
    return c;
};

// Random scatter: check each launch several times
const REPEAT = 25;

/** Replace Math.random with a fixed pseudo-random sequence (restored after each test). */
const seedRandom = (seed: number) => {
    let s = seed;
    vi.spyOn(Math, 'random').mockImplementation(() => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; });
};
afterEach(() => { vi.restoreAllMocks(); });

describe('launchCorpse', () => {
    it('fall ends lying down', () => {
        for (let i = 0; i < REPEAT; i++) {
            const c = launched('fall');
            run(c, 480);
            const { neck, hip } = c.points;
            expect(Math.abs(neck.y - hip.y)).toBeLessThan(Math.abs(neck.x - hip.x));
        }
    });

    it('thrown flies away from the blast', () => {
        for (let i = 0; i < REPEAT; i++) {
            const c = launched('thrown', { dx: 40, dy: 0 });
            const start = { ...c.points.hip };
            let rose = false;
            run(c, 30, [FLOOR], () => { if (c.points.hip.y < start.y) rose = true; });
            expect(start.x - c.points.hip.x).toBeGreaterThan(20);
            expect(rose).toBe(true);
        }
    });

    it('a shot at chest height knocks the body onto its back, away from the shooter', () => {
        for (let i = 0; i < REPEAT; i++) {
            const c = launched('thrown', { dx: 15, dy: -6 });
            run(c, 240);
            const { head, hip } = c.points;
            expect(head.x).toBeLessThan(hip.x);
        }
    });

    it('a splash right beside the body throws it at least as hard as one farther off', () => {
        seedRandom(7); // the scatter is random: a fixed sequence keeps the comparison from ever flaking
        const meanSpeed = (dx: number) => {
            let sum = 0;
            for (let i = 0; i < REPEAT; i++) {
                const c = createCorpse(death({ kind: 'thrown' }));
                launchCorpse(c, { x: c.points.hip.x + dx, y: TOP - 2 }, { x: 0, y: 0 }, true);
                sum += Math.hypot(c.points.hip.x - c.points.hip.px, c.points.hip.y - c.points.hip.py);
            }
            return sum / REPEAT;
        };
        expect(meanSpeed(10)).toBeGreaterThanOrEqual(meanSpeed(60));
    });

    it('a fast victim is slowed as a whole to the speed cap, not point by point', () => {
        const c = createCorpse(death({ kind: 'thrown' }));
        launchCorpse(c, { x: c.points.hip.x + 40, y: c.points.hip.y }, { x: -40, y: 0 });
        const speeds = Object.values(c.points).map(p => Math.hypot(p.x - p.px, p.y - p.py));
        expect(Math.max(...speeds)).toBeCloseTo(MAX_SPEED, 5);
        // The slower points stay slower: the throw keeps its spin
        expect(Math.min(...speeds)).toBeLessThan(MAX_SPEED - 1);
    });

    it('gib separates the pieces', () => {
        for (let i = 0; i < REPEAT; i++) {
            const c = createCorpse(death({ kind: 'gib' }));
            const len = linkLen(c, 'head', 'neck');
            launchCorpse(c, { x: c.points.hip.x + 14, y: c.points.hip.y }, { x: 0, y: 0 });
            expect(c.links.some(l => l.joint)).toBe(false);
            run(c, 30);
            expect(dist(c, 'head', 'neck')).toBeGreaterThan(2 * len);
        }
    });

    it('cut separates the halves', () => {
        for (let i = 0; i < REPEAT; i++) {
            const c = launched('cut', { dx: 300, dy: -10 });
            expect(c.links.some(l => l.waist)).toBe(false);
            const head = { ...c.points.head }, anF = { ...c.points.anF }, anB = { ...c.points.anB };
            run(c, 60);
            expect(Math.hypot(c.points.head.x - head.x, c.points.head.y - head.y)).toBeGreaterThan(30);
            expect(Math.hypot(c.points.anF.x - anF.x, c.points.anF.y - anF.y)).toBeLessThan(10);
            expect(Math.hypot(c.points.anB.x - anB.x, c.points.anB.y - anB.y)).toBeLessThan(10);
        }
    });

    it('cut leaves no link between the upper and the lower half', () => {
        const lower = new Set<CorpsePointId>(['hip', 'knF', 'anF', 'knB', 'anB']);
        const c = launched('cut');
        expect(c.links.every(l => lower.has(l.a) === lower.has(l.b))).toBe(true);
    });

    it('adds the victim velocity to the launch', () => {
        const still = createCorpse(death());
        const moving = createCorpse(death());
        launchCorpse(still, undefined, { x: 0, y: 0 });
        launchCorpse(moving, undefined, { x: 4, y: 0 });
        const vx = (c: Corpse) => c.points.hip.x - c.points.hip.px;
        expect(vx(moving)).toBeGreaterThan(vx(still) + 1);
    });
});

describe('corpse list', () => {
    it('the cap fades the oldest', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (let i = 0; i <= MAX_CORPSES; i++) addCorpse(state, death({ x: i * 100 }));
        const first = state.corpses[0];
        expect(first.fadeAt).toBeLessThanOrEqual(first.age);
        // It still fades for its usual 1 s (120 ticks), not for the rest of its lifetime
        expect(first.removeAt - first.fadeAt).toBe(120);
        expect(state.corpses.slice(1).every(c => c.fadeAt > c.age)).toBe(true);
    });

    it('a missing kind falls', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const e = death() as Partial<DeathEvent>;
        delete e.vel;
        expect(addCorpse(state, e as DeathEvent).kind).toBe('fall');
    });

    it('an unknown kind from the host falls (a newer or hostile host must not throw)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const e = { ...death(), kind: 'burn' } as unknown as DeathEvent;
        const c = addCorpse(state, e);
        expect(c.kind).toBe('fall');
        expect([c.fadeAt, c.removeAt]).toEqual([420, 540]);
    });

    it('a weapon that is not a weapon type is dropped (a hostile host must not break drawing)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const bad = addCorpse(state, { ...death(), weapon: 42 } as unknown as DeathEvent);
        expect(bad.weapon).toBeUndefined();
        const odd = addCorpse(state, { ...death(), weapon: 'constructor' } as unknown as DeathEvent);
        expect(odd.weapon).toBeUndefined();
        expect(addCorpse(state, death({ weapon: WeaponType.SHOTGUN })).weapon).toBe(WeaponType.SHOTGUN);
    });

    it('keeps the id of a lit fuel tank only when it is a string (a hostile host may send anything)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        expect(addCorpse(state, death({ tank: 'tank_1' })).tankId).toBe('tank_1');
        expect(addCorpse(state, { ...death(), tank: 7 } as unknown as DeathEvent).tankId).toBeUndefined();
        expect(addCorpse(state, { ...death(), tank: { id: 'x' } } as unknown as DeathEvent).tankId).toBeUndefined();
        expect(addCorpse(state, death()).tankId).toBeUndefined();
    });

    it('a corpse with a lit tank burns while the corpses are stepped', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        addCorpse(state, death({ tank: 'tank_1' }));
        state.particles = [];
        for (let i = 0; i < 10; i++) updateCorpses(state);
        expect(state.particles.some(p => p.type === 'fire')).toBe(true);
    });

    it('corpse with nothing under it is removed on time', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms = [];
        addCorpse(state, death({ kind: 'thrown', from: { x: 40, y: TOP - 30 } }));
        let finite = true;
        for (let i = 0; i < 540; i++) {
            updateCorpses(state);
            for (const c of state.corpses) {
                for (const p of Object.values(c.points)) {
                    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) finite = false;
                }
            }
        }
        expect(state.corpses).toHaveLength(0);
        expect(finite).toBe(true);
    });
});
