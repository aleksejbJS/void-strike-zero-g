import { describe, it, expect } from 'vitest';
import { GameMode, Platform } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent } from '../events';
import { Corpse, CorpsePointId, createCorpse } from './corpseBody';
import { speedOf, stepCorpse } from './corpseStep';
import { launchCorpse, pushCorpses } from './corpseLaunch';
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

describe('pushCorpses', () => {
    it('an explosion pushes a lying body', () => {
        const near = launched('fall');
        const far = createCorpse(death({ x: 430 }));
        launchCorpse(far, undefined, { x: 0, y: 0 });
        run(near, 480);
        run(far, 480);
        const farBefore = JSON.stringify(far.points);
        pushCorpses([near, far], near.points.hip.x + 30, near.points.hip.y);
        expect(speedOf(near)).toBeGreaterThan(1);
        // 400 units away: not touched at all
        expect(Math.abs(far.points.hip.x - near.points.hip.x - 30)).toBeGreaterThan(300);
        expect(JSON.stringify(far.points)).toBe(farBefore);
    });
});

describe('corpse list', () => {
    it('the cap fades the oldest', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (let i = 0; i <= MAX_CORPSES; i++) addCorpse(state, death({ x: i * 100 }));
        const first = state.corpses[0];
        expect(first.fadeAt).toBeLessThanOrEqual(first.age);
        expect(state.corpses.slice(1).every(c => c.fadeAt > c.age)).toBe(true);
    });

    it('a missing kind falls', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const e = death() as Partial<DeathEvent>;
        delete e.vel;
        expect(addCorpse(state, e as DeathEvent).kind).toBe('fall');
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
