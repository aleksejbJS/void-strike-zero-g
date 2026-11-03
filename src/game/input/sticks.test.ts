import { describe, it, expect } from 'vitest';
import { aimDirection, aimPoint, deflection, isFiring, moveKeys, STICK_RADIUS } from './sticks';

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

    it('fires only when pushed well past the dead zone', () => {
        expect(isFiring(deflection(stick(10, 0)))).toBe(false);
        expect(isFiring(deflection(stick(STICK_RADIUS, 0)))).toBe(true);
    });

    it('aims at a point out from the fighter along the stick', () => {
        expect(aimPoint({ x: 10, y: 20 }, { x: 0, y: -1 }, 300)).toEqual({ x: 10, y: -280 });
    });
});
