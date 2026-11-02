import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, EARS, FighterBuild, HELMETS, VISORS } from '../../../build/buildParts';
import { FighterLook } from '../fighterLook';
import { drawHead, headKeyOf } from './helmets';
import { drawEars } from './ears';
import { IDLE_PARTS, PartMotionFrame } from './partMotionFrame';

const lookWith = (parts: Partial<FighterBuild>, colors: Partial<FighterLook> = {}): FighterLook => ({
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x22c55e, pattern: 0xe11d48, build: { ...DEFAULT_BUILD, ...parts }, ...colors,
});

const instructionCount = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const n = g.context.instructions.length;
    g.destroy({ children: true, context: true });
    return n;
};

/**
 * The recorded drawing instructions as text, to tell two drawings apart. Fill textures (they point back at the
 * context) and path ids (they count up with every path) are left out, so equal drawings give equal text.
 */
const instructionsOf = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const text = JSON.stringify(g.context.instructions, (key, value) => (key === 'texture' || key === 'uid' ? undefined : value));
    g.destroy({ children: true, context: true });
    return text;
};

const ACTIVE: PartMotionFrame = { ...IDLE_PARTS, earFlop: 1, lampOn: true };

describe('drawHead', () => {
    for (const helmet of HELMETS) {
        for (const visor of VISORS) {
            it(`draws the ${helmet} helmet with the ${visor} visor`, () => {
                expect(instructionCount(g => drawHead(g, lookWith({ helmet, visor })))).toBeGreaterThan(0);
            });
        }
    }

    it('draws every ears option on every helmet without throwing', () => {
        for (const helmet of HELMETS) {
            for (const ears of EARS) expect(() => instructionCount(g => drawHead(g, lookWith({ helmet, ears })))).not.toThrow();
        }
    });
});

describe('drawEars', () => {
    for (const ears of EARS.filter(e => e !== 'none')) {
        it(`draws ${ears} at rest and in motion`, () => {
            for (const helmet of HELMETS) {
                expect(instructionCount(g => drawEars(g, lookWith({ helmet, ears }), IDLE_PARTS))).toBeGreaterThan(0);
                expect(instructionCount(g => drawEars(g, lookWith({ helmet, ears }), ACTIVE))).toBeGreaterThan(0);
            }
        });
    }

    it('tips the bunny ears back as they flop', () => {
        const bunny = lookWith({ ears: 'bunny' });
        const drawn = (earFlop: number) => instructionsOf(g => drawEars(g, bunny, { ...IDLE_PARTS, earFlop }));
        expect(drawn(1)).not.toBe(drawn(0));
        expect(drawn(0.5)).not.toBe(drawn(0));
    });

    it('lights the lamp bulb when it is on', () => {
        const lamp = lookWith({ ears: 'lamp' });
        const drawn = (lampOn: boolean) => instructionsOf(g => drawEars(g, lamp, { ...IDLE_PARTS, lampOn }));
        expect(drawn(true)).not.toBe(drawn(false));
    });

    it('draws nothing without ears', () => {
        expect(instructionCount(g => drawEars(g, lookWith({ ears: 'none' }), IDLE_PARTS))).toBe(0);
        expect(instructionCount(g => drawEars(g, lookWith({ ears: 'none' }), ACTIVE))).toBe(0);
    });
});

describe('headKeyOf', () => {
    const base = lookWith({});

    it('is the same for an identical look', () => {
        expect(headKeyOf(lookWith({}))).toBe(headKeyOf(base));
    });

    it('changes when a head part or a head colour changes', () => {
        const changed = [
            lookWith({ helmet: 'dome' }),
            lookWith({ visor: 'eyes' }),
            lookWith({ ears: 'wolf' }),
            lookWith({}, { head: 0x123456 }),
            lookWith({}, { visor: 0x654321 }),
        ];
        for (const look of changed) expect(headKeyOf(look)).not.toBe(headKeyOf(base));
    });
});
