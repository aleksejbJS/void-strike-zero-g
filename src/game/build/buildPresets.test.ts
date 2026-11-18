import { describe, it, expect } from 'vitest';
import { SKINS } from '../../constants';
import { DEFAULT_BUILD, SLOTS, Slot } from './buildParts';
import { presetBuild } from './buildPresets';

// Parts that are free from the start. Hard-coded here so the preset check
// stays independent of the unlock table.
const FREE: Record<Slot, readonly string[]> = {
    helmet: ['none', 'round', 'box'],
    visor: ['none', 'strip'],
    ears: ['none', 'cat', 'antennae'],
    tail: ['none', 'cat', 'tentacle'],
    jetpack: ['pack'],
    flame: ['fire'],
    pattern: ['none', 'band'],
    badge: ['none'],
};

describe('presetBuild', () => {
    it('gives all five illustrated bases an uncovered face and their own body identity', () => {
        const bases = [
            ['base-human', 'human'], ['base-female', 'human-female'], ['base-robot', 'robot'],
            ['base-toxic', 'toxic'], ['base-cat', 'cat'],
        ];
        for (const [id, body] of bases) {
            expect(presetBuild(id)).toMatchObject({
                body, helmet: 'none', visor: 'none', ears: 'none', tail: 'none', pattern: 'none',
            });
        }
    });

    it('human skins get round helmet, strip, no ears, no tail', () => {
        expect(presetBuild('classic')).toMatchObject({
            helmet: 'round', visor: 'strip', ears: 'none', tail: 'none', pattern: 'none', visorColor: '#7fd3ff',
        });
    });

    it('robots get the box and the chest band in their accent', () => {
        const build = presetBuild('cyborg');
        expect(build.helmet).toBe('box');
        expect(build.pattern).toBe('band');
        expect(build.patternColor).toBe('#8b5cf6');
        expect(build.visorColor).toBe('#8b5cf6');
    });

    it('beasts get cat ears and a cat tail, Hammy has no tail', () => {
        expect(presetBuild('wolf').tail).toBe('cat');
        expect(presetBuild('wolf').ears).toBe('cat');
        expect(presetBuild('hamster').tail).toBe('none');
        expect(presetBuild('hamster').ears).toBe('cat');
    });

    it('aliens get antennae and the tentacle', () => {
        expect(presetBuild('toxic')).toMatchObject({ ears: 'antennae', tail: 'tentacle' });
    });

    it('every preset uses only free parts', () => {
        for (const skin of SKINS) {
            const build = presetBuild(skin.id);
            for (const slot of Object.keys(SLOTS) as Slot[]) {
                expect(FREE[slot], `${skin.id}.${slot}=${build[slot]}`).toContain(build[slot]);
            }
        }
    });

    it('returns the default build for an unknown skin id', () => {
        expect(presetBuild('nope')).toEqual(DEFAULT_BUILD);
    });

    it('returns a fresh object each time', () => {
        expect(presetBuild('nope')).not.toBe(DEFAULT_BUILD);
        expect(presetBuild('classic')).not.toBe(presetBuild('classic'));
    });
});
