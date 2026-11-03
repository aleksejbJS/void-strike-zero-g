import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { SMOKE_DURATION_MS, spawnSmoke } from '../systems/smoke';
import { fighterInSmoke, fighterSmokeVisibility, smokeSilhouette } from './smokeVisibility';

const NOW = 50_000;

// A standing fighter (72 px tall) with feet at (0, 0): the body centre is at (0, -36)
const setup = () => {
    const state = createMockState(GameMode.DEATHMATCH);
    const p = createMockPlayer('a', Team.RED);
    return { state, p };
};

describe('fighterSmokeVisibility', () => {
    it('shows any fighter outside smoke', () => {
        expect(fighterSmokeVisibility(false, false)).toBe('shown');
        expect(fighterSmokeVisibility(false, true)).toBe('shown');
    });

    it('hides other fighters inside smoke', () => {
        expect(fighterSmokeVisibility(true, false)).toBe('hidden');
    });

    it('shows your own fighter inside smoke as a silhouette', () => {
        expect(fighterSmokeVisibility(true, true)).toBe('silhouette');
    });
});

describe('fighterInSmoke', () => {
    it('is false with no clouds', () => {
        const { state, p } = setup();
        expect(fighterInSmoke(state, p, NOW)).toBe(false);
    });

    it('tests the body centre, not the feet', () => {
        const { state, p } = setup();
        // 100 px below the feet: the feet (0, 0) are inside the 110 px cloud, the centre (0, -36) is 136 px away
        spawnSmoke(state, { x: 0, y: 100 }, NOW);
        expect(fighterInSmoke(state, p, NOW)).toBe(false);
        // 100 px above the centre: the centre is inside, the feet (136 px away) are not
        state.smokes = [];
        spawnSmoke(state, { x: 0, y: -136 }, NOW);
        expect(fighterInSmoke(state, p, NOW)).toBe(true);
    });

    it('is false once the cloud has expired', () => {
        const { state, p } = setup();
        spawnSmoke(state, { x: 0, y: -36 }, NOW);
        expect(fighterInSmoke(state, p, NOW + SMOKE_DURATION_MS)).toBe(false);
    });
});

describe('smokeSilhouette', () => {
    it('is the hitbox of a living local fighter inside smoke', () => {
        const { state, p } = setup();
        p.pos = { x: 200, y: 300 };
        p.height = 45;
        spawnSmoke(state, { x: 200, y: 280 }, NOW);
        expect(smokeSilhouette(state, p, NOW)).toEqual({ x: 200, y: 300, w: 30, h: 45 });
    });

    it('is null outside smoke, for a dead fighter, or with no local fighter', () => {
        const { state, p } = setup();
        expect(smokeSilhouette(state, p, NOW)).toBeNull();
        spawnSmoke(state, { x: 0, y: -36 }, NOW);
        expect(smokeSilhouette(state, { ...p, dead: true }, NOW)).toBeNull();
        expect(smokeSilhouette(state, undefined, NOW)).toBeNull();
    });
});
