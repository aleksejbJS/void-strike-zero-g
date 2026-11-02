import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD, FighterBuild, SLOTS, TAILS } from '../../../game/build/buildParts';
import { isHeadSlot, thumbnailBuilds } from './partThumbnails';

const base: FighterBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'cat', tail: 'lizard', pattern: 'camo' };

describe('thumbnailBuilds', () => {
    it('gives one build per tail, differing from the base only in the tail', () => {
        const builds = thumbnailBuilds('tail', base);
        expect(builds).toHaveLength(5);
        expect(builds.map(item => item.id)).toEqual([...TAILS]);
        builds.forEach(({ id, build }) => expect(build).toEqual({ ...base, tail: id }));
    });

    it('covers every option of every slot and leaves the base untouched', () => {
        const before = { ...base };
        (Object.keys(SLOTS) as (keyof typeof SLOTS)[]).forEach(slot => {
            expect(thumbnailBuilds(slot, base).map(item => item.id)).toEqual([...SLOTS[slot]]);
        });
        expect(base).toEqual(before);
    });
});

describe('isHeadSlot', () => {
    it('is true only for the helmet, visor and ears', () => {
        const head = (Object.keys(SLOTS) as (keyof typeof SLOTS)[]).filter(isHeadSlot);
        expect(head).toEqual(['helmet', 'visor', 'ears']);
    });
});
