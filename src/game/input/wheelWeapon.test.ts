import { describe, it, expect } from 'vitest';
import { createWheelGate, cycleWeaponIndex, WHEEL_GESTURE_GAP_MS, wheelStep } from './wheelWeapon';

const wheel = (deltaY: number, deltaX = 0, ctrlKey = false) => ({ deltaX, deltaY, ctrlKey });

describe('wheelStep', () => {
    it('goes to the next slot on wheel down and the previous on wheel up', () => {
        expect(wheelStep(wheel(100))).toBe(1);
        expect(wheelStep(wheel(-3))).toBe(-1);
    });

    it('ignores pinch-zoom, horizontal swipes and empty events', () => {
        expect(wheelStep(wheel(40, 0, true))).toBe(0);
        expect(wheelStep(wheel(5, 30))).toBe(0);
        expect(wheelStep(wheel(0))).toBe(0);
    });
});

describe('cycleWeaponIndex', () => {
    const full = ['mg', 'shotgun', 'rocket'];

    it('steps forward and back', () => {
        expect(cycleWeaponIndex(full, 0, 1)).toBe(1);
        expect(cycleWeaponIndex(full, 1, -1)).toBe(0);
    });

    it('wraps round at both ends', () => {
        expect(cycleWeaponIndex(full, 2, 1)).toBe(0);
        expect(cycleWeaponIndex(full, 0, -1)).toBe(2);
    });

    it('skips empty slots', () => {
        const holes = ['mg', undefined, undefined, 'rail'];
        expect(cycleWeaponIndex(holes, 0, 1)).toBe(3);
        expect(cycleWeaponIndex(holes, 3, 1)).toBe(0);
    });

    it('starts from an end when nothing is held', () => {
        expect(cycleWeaponIndex(full, -1, 1)).toBe(0);
        expect(cycleWeaponIndex(full, -1, -1)).toBe(2);
    });

    it('has nothing to switch to with one weapon or none', () => {
        expect(cycleWeaponIndex(['mg'], 0, 1)).toBeNull();
        expect(cycleWeaponIndex([], -1, 1)).toBeNull();
    });
});

describe('createWheelGate', () => {
    it('lets one event through per gesture, however long the burst', () => {
        const gate = createWheelGate();
        const burst = Array.from({ length: 60 }, (_, i) => gate(1000 + i * 16)); // a 1 s trackpad swipe
        expect(burst.filter(Boolean)).toHaveLength(1);
    });

    it('opens again after a quiet gap', () => {
        const gate = createWheelGate();
        expect(gate(1000)).toBe(true);
        expect(gate(1000 + WHEEL_GESTURE_GAP_MS - 1)).toBe(false);
        expect(gate(1000 + 2 * WHEEL_GESTURE_GAP_MS)).toBe(true);
    });
});
