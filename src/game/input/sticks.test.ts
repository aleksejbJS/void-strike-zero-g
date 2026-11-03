import { describe, it, expect } from 'vitest';
import { AIM_STICK_RADIUS, aimDirection, aimPoint, deflection, isFiring, moveKeys, smoothAim, STICK_RADIUS } from './sticks';

const stick = (dx: number, dy: number) => ({ originX: 100, originY: 200, x: 100 + dx, y: 200 + dy });

describe('deflection', () => {
    it('is the offset from the origin as a share of the stick radius', () => {
        const d = deflection(stick(STICK_RADIUS / 2, 0));
        expect(d.x).toBeCloseTo(0.5);
        expect(d.y).toBeCloseTo(0);
        expect(d.amount).toBeCloseTo(0.5);
    });

    it('stops at the rim when the finger slides further', () => {
        const d = deflection(stick(0, -STICK_RADIUS * 3));
        expect(d.y).toBeCloseTo(-1);
        expect(d.amount).toBe(1);
    });
});

describe('moveKeys', () => {
    it('pushing up jumps / flies and pushing sideways runs', () => {
        expect(moveKeys(deflection(stick(-40, -40)))).toEqual({ KeyW: true, KeyS: false, KeyA: true, KeyD: false });
    });

    it('a small wobble presses nothing', () => {
        expect(moveKeys(deflection(stick(5, -5)))).toEqual({ KeyW: false, KeyS: false, KeyA: false, KeyD: false });
    });
});

describe('aim stick', () => {
    it('has no direction inside the dead zone', () => {
        expect(aimDirection(deflection(stick(2, 1)))).toBeNull();
    });

    it('points where the stick is pushed, as a unit vector', () => {
        const dir = aimDirection(deflection(stick(30, 40)))!;
        expect(dir.x).toBeCloseTo(0.6);
        expect(dir.y).toBeCloseTo(0.8);
    });

    it('only aims inside the circle and fires at the edge', () => {
        expect(isFiring(deflection(stick(AIM_STICK_RADIUS / 2, 0), AIM_STICK_RADIUS))).toBe(false);
        expect(isFiring(deflection(stick(AIM_STICK_RADIUS * 0.8, 0), AIM_STICK_RADIUS))).toBe(false);
        expect(isFiring(deflection(stick(AIM_STICK_RADIUS, 0), AIM_STICK_RADIUS))).toBe(true);
    });

    it('the aim glides towards the stick instead of jumping', () => {
        const right = { x: 1, y: 0 };
        const up = { x: 0, y: -1 };
        const step = smoothAim(right, up, 16);
        const angle = Math.atan2(step.y, step.x);
        expect(angle).toBeLessThan(0);              // turned towards up…
        expect(angle).toBeGreaterThan(-Math.PI / 2); // …but not all the way in one frame
        expect(Math.hypot(step.x, step.y)).toBeCloseTo(1);
        let aim = right;
        for (let i = 0; i < 30; i++) aim = smoothAim(aim, up, 16); // half a second
        expect(aim.y).toBeCloseTo(-1, 2);
    });

    it('turns the short way round', () => {
        const step = smoothAim({ x: -1, y: -0.01 }, { x: -1, y: 0.01 }, 16);
        expect(step.x).toBeLessThan(-0.99); // stays on the left, no swing through the right
    });

    it('starts at the stick when there is no aim yet', () => {
        expect(smoothAim(null, { x: 0, y: 1 }, 16)).toEqual({ x: 0, y: 1 });
    });

    it('aims at a point out from the fighter along the stick', () => {
        expect(aimPoint({ x: 10, y: 20 }, { x: 0, y: -1 }, 300)).toEqual({ x: 10, y: -280 });
    });
});
