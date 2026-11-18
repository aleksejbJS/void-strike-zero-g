import { describe, it, expect } from 'vitest';
import { SmokeStirs } from './smokeStirs';
import type { Stir } from './airGrid';
import { IMPULSE_DT } from './smokeTuning';
import { beam, fighter, flameWith, frame, projectile, ring } from './smokeStirs.testkit';

type Group = 'rocket' | 'blast' | 'beam' | 'flame' | 'fighter';

/** Collect one frame of everything that stirs, the frame lasting `frameDt` seconds (undefined: not given), sorted by source. */
const everything = (frameDt?: number): Record<Group, Stir[]> => {
    const stirs = new SmokeStirs(), out: Stir[] = [];
    const state = frame({
        projectiles: [projectile('r1', 100, 200, 30, 0)], particles: [ring('ring_1', 300, 200)],
        beams: [beam('b1', 0, 400, 50, 400)], players: [fighter(5, 0)],
    });
    stirs.collect(state, flameWith([{ x: 100, y: 600, angle: 0, firing: true, power: 1 }]), out, frameDt);
    return {
        rocket: out.filter(s => s.rate === 40), blast: out.filter(s => s.radial), beam: out.filter(s => s.rate === 45),
        flame: out.filter(s => s.rate === 27), fighter: out.filter(s => s.rate === 24),
    };
};

describe('SmokeStirs dt', () => {
    it('travelling and one-shot stirs carry the fixed impulse time, whatever the frame lasted', () => {
        for (const frameDt of [1 / 120, 1 / 30, 0.5, undefined]) {
            const all = everything(frameDt);
            for (const group of [all.rocket, all.blast, all.beam]) {
                expect(group.length).toBeGreaterThan(0);
                for (const s of group) expect(s.dt).toBeCloseTo(IMPULSE_DT, 12);
            }
        }
    });

    it('continuous stirs (a fighter, a flame stream) carry the frame\'s own time', () => {
        for (const frameDt of [1 / 144, 1 / 60, 1 / 30]) {
            const all = everything(frameDt);
            expect(all.fighter.length).toBe(1);
            expect(all.flame.length).toBeGreaterThan(30);
            for (const s of [...all.fighter, ...all.flame]) expect(s.dt).toBeCloseTo(frameDt, 12);
        }
    });

    it('a continuous stir carries at most 0.1 s, so a hitch does not become a huge push', () => {
        for (const s of [...everything(0.4).fighter, ...everything(30).flame]) expect(s.dt).toBeCloseTo(0.1, 12);
    });

    it('a continuous stir falls back to the impulse time for a frame time that is not a positive number', () => {
        for (const frameDt of [0, -1, Number.NaN, Infinity, undefined]) {
            const all = everything(frameDt);
            for (const s of [...all.fighter, ...all.flame]) expect(s.dt).toBeCloseTo(IMPULSE_DT, 12);
        }
    });
});
