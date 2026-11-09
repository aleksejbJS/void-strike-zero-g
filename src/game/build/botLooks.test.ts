import { describe, it, expect } from 'vitest';
import { BODY_PRESETS } from './characterBases';
import { ffaBotLooks } from './botLooks';
import { presetBuild } from './buildPresets';
import { sanitizeBuild } from './sanitizeBuild';

// Deterministic generator so the shuffle and the random parts are repeatable.
const seeded = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

describe('ffaBotLooks', () => {
    it('gives every bot a different skin while there are enough skins', () => {
        const looks = ffaBotLooks(5, seeded(1));
        expect(new Set(looks.map(l => l.skinId))).toEqual(new Set([
            'base-human', 'base-female', 'base-robot', 'base-toxic', 'base-cat',
        ]));
    });

    it('starts over the skin list when there are more bots than skins', () => {
        const looks = ffaBotLooks(7, seeded(2));
        expect(looks).toHaveLength(7);
        expect(looks[5].skinId).toBe(looks[0].skinId);
    });

    it('wears the colours of its skin', () => {
        for (const look of ffaBotLooks(5, seeded(3))) {
            const skin = BODY_PRESETS.find(s => s.id === look.skinId)!;
            expect(look).toMatchObject({
                color: skin.color, torsoColor: skin.palette.torso, headColor: skin.palette.head,
                armColor: skin.palette.arms, legColor: skin.palette.legs, jetpackColor: skin.palette.jetpack,
            });
        }
    });

    it('keeps the preset helmet, ears, tail and colours', () => {
        for (const look of ffaBotLooks(5, seeded(4))) {
            const preset = presetBuild(look.skinId);
            const { body, helmet, visor, ears, tail, jetpack, visorColor, patternColor } = look.build;
            expect({ body, helmet, visor, ears, tail, jetpack, visorColor, patternColor }).toEqual({
                body: preset.body,
                helmet: preset.helmet, visor: preset.visor, ears: preset.ears, tail: preset.tail,
                jetpack: preset.jetpack, visorColor: preset.visorColor, patternColor: preset.patternColor,
            });
        }
    });

    it('only uses valid parts', () => {
        for (const look of ffaBotLooks(20, seeded(5))) {
            expect(sanitizeBuild(look.build)).toEqual(look.build);
        }
    });

    it('varies the random parts between bots', () => {
        const looks = ffaBotLooks(5, seeded(6));
        const combos = new Set(looks.map(l => `${l.build.flame}/${l.build.pattern}/${l.build.badge}`));
        expect(combos.size).toBeGreaterThan(1);
    });
});
