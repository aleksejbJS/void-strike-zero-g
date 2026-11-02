import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD, FighterBuild } from '../../build/buildParts';
import { presetBuild } from '../../build/buildPresets';
import { FighterLook, flashLook, lookFromEntity, lookFromSetup, shade } from './fighterLook';

const entityColors = {
    color: '#3366cc', headColor: '#112233', torsoColor: '#445566', armColor: '#778899',
    legColor: '#0a0b0c', jetpackColor: '#ff8800',
};

describe('lookFromEntity', () => {
    it('uses the entity build when present', () => {
        const build: FighterBuild = { ...DEFAULT_BUILD, helmet: 'angular', ears: 'horns', visorColor: '#ff0000', patternColor: '#00ff00' };
        const look = lookFromEntity({ ...entityColors, skinId: 'cyborg', build });
        expect(look.build).toBe(build);
        expect(look.build.helmet).toBe('angular');
    });

    it('falls back to the skin preset when build is missing', () => {
        const look = lookFromEntity({ ...entityColors, skinId: 'cyborg' });
        expect(look.build.helmet).toBe('box');
        expect(look.pattern).toBe(0x8b5cf6);
        expect(look.build).toEqual(presetBuild('cyborg'));
    });

    it('keeps the body colours', () => {
        const look = lookFromEntity({ ...entityColors, skinId: 'classic' });
        expect(look.head).toBe(0x112233);
        expect(look.torso).toBe(0x445566);
        expect(look.arm).toBe(0x778899);
        expect(look.leg).toBe(0x0a0b0c);
        expect(look.jet).toBe(0xff8800);
    });

    it('visor and pattern come from the build colours', () => {
        const build: FighterBuild = { ...DEFAULT_BUILD, visorColor: '#102030', patternColor: '#a0b0c0' };
        const look = lookFromEntity({ ...entityColors, skinId: 'classic', build });
        expect(look.visor).toBe(0x102030);
        expect(look.pattern).toBe(0xa0b0c0);
    });

    it('turns an invalid build colour into the neutral fallback', () => {
        const build: FighterBuild = { ...DEFAULT_BUILD, visorColor: 'nope', patternColor: '' };
        const look = lookFromEntity({ ...entityColors, skinId: 'classic', build });
        expect(look.visor).toBe(0xe5e7eb);
        expect(look.pattern).toBe(0xe5e7eb);
    });
});

describe('lookFromSetup', () => {
    const colors = { head: '#111111', torso: '#222222', arms: '#333333', legs: '#444444', jetpack: '#555555' };

    it('takes the colours from the setup and the parts from the build', () => {
        const build = presetBuild('classic');
        const look = lookFromSetup(colors, build);
        expect(look.head).toBe(0x111111);
        expect(look.torso).toBe(0x222222);
        expect(look.arm).toBe(0x333333);
        expect(look.leg).toBe(0x444444);
        expect(look.jet).toBe(0x555555);
        expect(look.build).toBe(build);
        expect(look.visor).toBe(0x7fd3ff);
    });
});

describe('flashLook', () => {
    const look: FighterLook = { head: 0x808080, torso: 0x204060, arm: 0xf0f0f0, leg: 0x102030, jet: 0xfbbf24, visor: 0x336699, pattern: 0xe5e7eb, build: DEFAULT_BUILD };

    it('reuses the same look when there is no flash', () => {
        expect(flashLook(look, 0)).toBe(look);
    });

    it('lightens the colours by 70% at full flash and keeps the build', () => {
        const lit = flashLook(look, 1);
        expect(lit).not.toBe(look);
        expect(lit.torso).toBe(shade(look.torso, 1.7));
        expect(lit.head).toBe(shade(look.head, 1.7));
        expect(lit.arm).toBe(0xffffff);
        expect(lit.visor).toBe(shade(look.visor, 1.7));
        expect(lit.pattern).toBe(shade(look.pattern, 1.7));
        expect(lit.build).toBe(DEFAULT_BUILD);
    });
});
