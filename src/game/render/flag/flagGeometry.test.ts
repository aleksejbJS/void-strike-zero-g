import { describe, expect, it } from 'vitest';
import { Entity, GameMode, ItemType, Pickup, Platform, Team } from '../../../types';
import { HTF_FLAG_POS } from '../../data/level';
import { clothShape, STANDARD_CLOTH } from './flagCloth';
import { placeGroundFlag, surfaceBelow } from './flagPlacement';
import { carriedWind } from './carriedWind';
import { carriedPaletteFor, FLAG_PALETTES, mixColor } from './flagPalette';

const still = { angle: 0, ampMul: 1, omegaMul: 1 };

describe('clothShape', () => {
    it('keeps the pole edge fixed while the free end moves', () => {
        const a = clothShape(STANDARD_CLOTH, still, 0.1);
        const b = clothShape(STANDARD_CLOTH, still, 0.6);
        expect(a.top[0]).toEqual({ x: 0, y: 0 });
        expect(b.top[0]).toEqual({ x: 0, y: 0 });
        expect(b.bottom[0].y).toBeCloseTo(STANDARD_CLOTH.height);
        const end = STANDARD_CLOTH.segments;
        expect(Math.abs(a.top[end].y - b.top[end].y)).toBeGreaterThan(1);
        expect(Math.abs(a.top[end].y - b.top[end].y)).toBeLessThanOrEqual(2 * STANDARD_CLOTH.amp + 0.01);
    });

    it('keeps shade within -1..1, one value per segment', () => {
        for (const t of [0, 0.3, 1.7, 4.2]) {
            const s = clothShape(STANDARD_CLOTH, { angle: 0.4, ampMul: 1.3, omegaMul: 2 }, t);
            expect(s.shade).toHaveLength(STANDARD_CLOTH.segments);
            s.shade.forEach(v => { expect(v).toBeGreaterThanOrEqual(-1); expect(v).toBeLessThanOrEqual(1); });
        }
    });

    it('puts the swallowtail point between the corners of the free end, cut inward', () => {
        const s = clothShape(STANDARD_CLOTH, still, 0.8);
        const end = STANDARD_CLOTH.segments;
        expect(s.notch).not.toBeNull();
        expect(s.notch!.x).toBeCloseTo(STANDARD_CLOTH.length - STANDARD_CLOTH.notch);
        expect(s.notch!.y).toBeGreaterThan(s.top[end].y);
        expect(s.notch!.y).toBeLessThan(s.bottom[end].y);
        expect(clothShape({ ...STANDARD_CLOTH, notch: 0 }, still, 0).notch).toBeNull();
    });

    it('turns the whole strip by the wind angle', () => {
        const s = clothShape({ ...STANDARD_CLOTH, amp: 0, sag: 0 }, { angle: Math.PI / 2, ampMul: 1, omegaMul: 1 }, 0);
        const end = s.top[STANDARD_CLOTH.segments];
        expect(end.x).toBeCloseTo(0);
        expect(end.y).toBeCloseTo(STANDARD_CLOTH.length);
    });
});

const plat = (x: number, y: number, w: number): Platform => ({ id: `p${x}`, x, y, w, h: 30, color: '#000' });
const flag = (id: string, team: Team, x: number, y: number): Pickup =>
    ({ id, type: ItemType.FLAG, team, pos: { x, y }, active: true, respawnTime: 0, value: 0 });

describe('placeGroundFlag', () => {
    const ctfBase = plat(-500, 500, 300);
    const pedestal = plat(980, 420, 40);

    it('stands a CTF flag on its base platform 30 px below pos', () => {
        const p = placeGroundFlag(flag('flag_blue', Team.BLUE, -350, 470), [ctfBase]);
        expect(p.kind).toBe('base');
        expect(p.foot).toEqual({ x: -350, y: 500 });
    });

    it('stands the neutral flag on its pedestal at the Hold the Flag spot', () => {
        const p = placeGroundFlag(flag('htf_flag', Team.NONE, HTF_FLAG_POS.x, HTF_FLAG_POS.y), [pedestal]);
        expect(p.kind).toBe('spot');
        expect(p.foot.y).toBe(420);
    });

    it('plants a dropped neutral flag where it fell, leaning the same way every frame', () => {
        const floor = plat(-1000, 800, 5000);
        const item = flag('htf_drop_7', Team.NONE, 300, 800);
        const p = placeGroundFlag(item, [floor]);
        expect(p.kind).toBe('dropped');
        expect(p.foot.y).toBe(800);
        expect(placeGroundFlag(item, [floor]).side).toBe(p.side);
    });

    it('leaves a flag with nothing below in mid-air', () => {
        const p = placeGroundFlag(flag('htf_throw_1', Team.NONE, 300, 100), [plat(-1000, 800, 5000)]);
        expect(p.kind).toBe('midair');
        expect(p.foot).toEqual({ x: 300, y: 100 });
    });

    it('takes the highest platform in reach and ignores ones beside pos', () => {
        expect(surfaceBelow({ x: 0, y: 100 }, [plat(-50, 130, 100), plat(-50, 110, 100), plat(60, 105, 50)])).toBe(110);
    });
});

describe('carriedWind', () => {
    it('hangs behind the back when the carrier stands still', () => {
        const w = carriedWind({ x: 0, y: 0 }, 1);
        expect(w.side).toBe(-1);
        expect(w.angle).toBeCloseTo(1.15);
        expect(carriedWind({ x: 0, y: 0 }, -1).side).toBe(1);
    });

    it('streams level behind a carrier running right', () => {
        const w = carriedWind({ x: 4, y: 0 }, 1);
        expect(w.side).toBe(-1);
        expect(w.angle).toBeCloseTo(0);
        expect(w.ampMul).toBeGreaterThan(carriedWind({ x: 0, y: 0 }, 1).ampMul);
    });

    it('points down when the carrier flies straight up', () => {
        expect(carriedWind({ x: 0, y: -5 }, 1).angle).toBeCloseTo(Math.PI / 2);
    });
});

describe('carriedPaletteFor', () => {
    const carrier = (team: Team, hasFlag: Team) => ({ team, hasFlag }) as Entity;

    it('shows the enemy flag in CTF, not intel yellow', () => {
        expect(carriedPaletteFor(carrier(Team.BLUE, Team.RED), GameMode.CTF)).toBe(FLAG_PALETTES.red);
        expect(carriedPaletteFor(carrier(Team.RED, Team.BLUE), GameMode.CTF)).toBe(FLAG_PALETTES.blue);
    });

    it('uses the neutral flag in Hold the Flag and intel yellow in Infiltration', () => {
        expect(carriedPaletteFor(carrier(Team.RED, Team.RED), GameMode.HOLD_THE_FLAG)).toBe(FLAG_PALETTES.neutral);
        expect(carriedPaletteFor(carrier(Team.BLUE, Team.RED), GameMode.INFILTRATION)).toBe(FLAG_PALETTES.intel);
    });

    it('mixes colours per channel', () => {
        expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
        expect(mixColor(0x102030, 0x102030, 0.7)).toBe(0x102030);
    });
});
