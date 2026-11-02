import { describe, it, expect, beforeEach } from 'vitest';
import { GameMode, Platform } from '../../types';
import { createMockState } from '../../test/mocks';
import { applyEffectEvent } from './effects';
import { addMark, addMarkAt, clearMarks, liveMarks, placeMark, placeMarkNear, MARK_CAP, MARK_LIFE_MS } from './marks';

const floor: Platform = { id: 'f', x: 0, y: 100, w: 200, h: 50, color: '' };

beforeEach(() => clearMarks());

describe('placeMark', () => {
    it('projects a point inside a wall onto its nearest edge', () => {
        expect(placeMark([{ id: 'w', x: 100, y: 0, w: 40, h: 300, color: '' }], 103, 150)).toEqual({ x: 100, y: 150 });
        expect(placeMark([floor], 50, 104)).toEqual({ x: 50, y: 100 });
    });

    it('projects onto the right and bottom edges too', () => {
        expect(placeMark([floor], 197, 120)).toEqual({ x: 200, y: 120 });
        expect(placeMark([floor], 50, 147)).toEqual({ x: 50, y: 150 });
    });

    it('makes no mark where no platform contains the point', () => {
        expect(placeMark([floor], 50, 50)).toBeNull();
    });

    it('keeps a point that lies exactly on the boundary where it is', () => {
        expect(placeMark([floor], 50, 100)).toEqual({ x: 50, y: 100 });
        expect(placeMark([floor], 0, 120)).toEqual({ x: 0, y: 120 });
        expect(placeMark([floor], 200, 150)).toEqual({ x: 200, y: 150 }); // a corner
    });

    it('still makes no mark just outside the boundary', () => {
        expect(placeMark([floor], 50, 99.999)).toBeNull();
        expect(placeMark([floor], -0.001, 120)).toBeNull();
    });
});

describe('marks list', () => {
    it('keeps at most 50 marks and drops the oldest', () => {
        // x = 50 + i stays well away from the side edges, so the mark x identifies its order
        for (let i = 0; i <= MARK_CAP; i++) addMark([floor], 50 + i, 104, 1000 + i);

        const marks = liveMarks(1000 + MARK_CAP);
        expect(marks).toHaveLength(MARK_CAP);
        expect(marks.some(m => m.x === 50)).toBe(false);
        expect(marks[0].x).toBe(51);
        expect(marks[marks.length - 1].x).toBe(50 + MARK_CAP);
    });

    it('forgets marks older than 4 s', () => {
        addMark([floor], 10, 104, 0);
        addMark([floor], 20, 104, 3000);

        expect(liveMarks(MARK_LIFE_MS - 1).map(m => m.x)).toEqual([10, 20]);
        expect(liveMarks(MARK_LIFE_MS).map(m => m.x)).toEqual([20]);
        expect(liveMarks(MARK_LIFE_MS + 3000)).toEqual([]);
    });

    it('gives each mark a radius of 2 to 3.5 and its birth time', () => {
        for (let i = 0; i < 20; i++) addMark([floor], 10, 104, 500);

        for (const m of liveMarks(500)) {
            expect(m.r).toBeGreaterThanOrEqual(2);
            expect(m.r).toBeLessThanOrEqual(3.5);
            expect(m.bornAt).toBe(500);
        }
    });

    it('adds nothing when the point is in open space', () => {
        expect(() => addMark([floor], 50, 50, 0)).not.toThrow();
        expect(liveMarks(0)).toEqual([]);
    });

    it('clearMarks empties the list', () => {
        addMark([floor], 10, 104, 0);
        clearMarks();
        expect(liveMarks(0)).toEqual([]);
    });
});

describe('spark events leave scorch marks', () => {
    it('a rail-style hit exactly on a wall edge leaves a mark at that point', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const wall: Platform = { id: 'w', x: 100, y: 0, w: 40, h: 300, color: '' };
        state.platforms.push(wall);

        applyEffectEvent(state, { type: 'EFFECT', effect: 'spark', x: wall.x, y: 150, color: '#38bdf8', count: 10 });

        const marks = liveMarks(Date.now());
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({ x: 100, y: 150 });
    });

    it('a spark inside a platform makes one mark on its edge', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms.push(floor);

        applyEffectEvent(state, { type: 'EFFECT', effect: 'spark', x: 50, y: 104 });

        const marks = liveMarks(Date.now());
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({ x: 50, y: 100 });
    });

    it('a spark in open space makes no mark and throws nothing', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms.push(floor);

        expect(() => applyEffectEvent(state, { type: 'EFFECT', effect: 'spark', x: 50, y: 50 })).not.toThrow();
        expect(liveMarks(Date.now())).toEqual([]);
    });
});

describe('placeMarkNear', () => {
    it('finds the floor top for a point 5 px above it', () => {
        expect(placeMarkNear([floor], 50, 95, 18)).toEqual({ x: 50, y: 100 });
    });

    it('finds nothing when the nearest surface is farther than maxDist', () => {
        expect(placeMarkNear([floor], 50, 70, 18)).toBeNull();
    });

    it('picks the closest of several platforms', () => {
        const wall: Platform = { id: 'w', x: 300, y: 0, w: 40, h: 300, color: '' };
        expect(placeMarkNear([floor, wall], 296, 120, 18)).toEqual({ x: 300, y: 120 });
    });

    it('projects a point inside a platform onto its nearest edge', () => {
        expect(placeMarkNear([floor], 50, 104, 18)).toEqual({ x: 50, y: 100 });
    });
});

describe('explosions leave a big scorch mark', () => {
    it('addMarkAt places a mark of the given radius', () => {
        addMarkAt([floor], 50, 95, 18, 18, 700);
        expect(liveMarks(700)).toEqual([{ x: 50, y: 100, r: 18, bornAt: 700 }]);
    });

    it('addMarkAt adds nothing in mid-air', () => {
        addMarkAt([floor], 50, 70, 18, 18, 0);
        expect(liveMarks(0)).toEqual([]);
    });

    it('an explosion next to a wall makes one mark of radius 18 on its face', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms.push({ id: 'w', x: 100, y: 0, w: 40, h: 300, color: '' });

        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 92, y: 150 });

        const marks = liveMarks(Date.now());
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({ x: 100, y: 150, r: 18 });
    });

    it('an explosion in mid-air leaves no mark', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.platforms.push(floor);

        applyEffectEvent(state, { type: 'EFFECT', effect: 'explosion', x: 50, y: 40 });

        expect(liveMarks(Date.now())).toEqual([]);
    });
});
