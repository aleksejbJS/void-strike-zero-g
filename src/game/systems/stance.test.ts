import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { readControls } from './playerControl';
import { applyStance, clampProneAim, clampProneAngle, CROUCH_HEIGHT, muzzleHeight, PRONE_HEIGHT, STANDING_HEIGHT } from './stance';

const player = (isGrounded = true) => ({ ...createMockPlayer('p', Team.NONE), isGrounded });
const deg = (rad: number) => (rad * 180) / Math.PI;

describe('stance', () => {
    it('stands, crouches with S and lies down with Z', () => {
        const p = player();
        applyStance(p, readControls(p, {}));
        expect([p.isCrouching, p.isProne, p.height]).toEqual([false, false, STANDING_HEIGHT]);
        applyStance(p, readControls(p, { KeyS: true }));
        expect([p.isCrouching, p.isProne, p.height]).toEqual([true, false, CROUCH_HEIGHT]);
        applyStance(p, readControls(p, { KeyS: true, KeyZ: true }));
        expect([p.isCrouching, p.isProne, p.height]).toEqual([false, true, PRONE_HEIGHT]);
    });

    it('a jump stands up, and nobody lies down in the air', () => {
        expect(readControls(player(), { KeyZ: true, KeyW: true }).wantsProne).toBe(false);
        expect(readControls(player(false), { KeyZ: true }).wantsProne).toBe(false);
    });

    it('shoots from low down while lying', () => {
        expect(muzzleHeight({ isCrouching: false, isProne: true })).toBeLessThan(muzzleHeight({ isCrouching: true, isProne: false }));
    });
});

describe('aim while lying', () => {
    it('keeps a level aim and turns a steep one into 30°, on either side', () => {
        expect(clampProneAngle(0.2)).toBeCloseTo(0.2);
        expect(deg(clampProneAngle(-Math.PI / 2 + 0.1))).toBeCloseTo(-30);  // up and a bit right
        expect(deg(clampProneAngle(-Math.PI / 2 - 0.1))).toBeCloseTo(-150); // up and a bit left
        expect(deg(clampProneAngle(Math.PI - 0.1))).toBeCloseTo(180 - deg(0.1));
    });

    it('moves the aim point only for a lying fighter', () => {
        const p = { ...player(), pos: { x: 0, y: 0 } };
        const above = { x: 10, y: -300 };
        expect(clampProneAim(p, above)).toEqual(above);
        p.isProne = true;
        const aim = clampProneAim(p, above);
        const angle = Math.atan2(aim.y - -muzzleHeight(p), aim.x);
        expect(deg(angle)).toBeCloseTo(-30);
    });
});
