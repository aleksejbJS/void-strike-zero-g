import { describe, expect, it } from 'vitest';
import { Team, WeaponType } from '../../../types';
import { ActorScript, carriedAt, crossed, isDeadAt, sampleActor, weaponAt, zoneAt } from './previewScript';
import { LIVE_SCENES } from './liveScenes';

const actor: ActorScript = {
    id: 'a', look: 'red', team: Team.NONE, weapon: WeaponType.MACHINE_GUN,
    keys: [
        { t: 0, x: 0, y: 100 },
        { t: 1, x: 100, y: 100, move: 'jet' },
        { t: 2, x: 100, y: 0 },
    ],
    death: { at: 1.5, respawn: 1.8, killer: 'b' },
};

describe('sampleActor', () => {
    it('runs at a steady speed on the ground', () => {
        const s = sampleActor(actor, 0.5);
        expect(s.pos.x).toBeCloseTo(50);
        expect(s.vel.x).toBeCloseTo(100, 0);
        expect(s.move).toBe('ground');
    });

    it('eases a jetpack flight in and out', () => {
        expect(sampleActor(actor, 1.5).pos.y).toBeCloseTo(50);
        expect(Math.abs(sampleActor(actor, 1.01).vel.y)).toBeLessThan(Math.abs(sampleActor(actor, 1.5).vel.y));
        expect(sampleActor(actor, 1.5).move).toBe('jet');
    });

    it('holds the last key after the end', () => {
        expect(sampleActor(actor, 5).pos).toEqual({ x: 100, y: 0 });
    });
});

describe('script timing', () => {
    it('is dead between the death and the respawn', () => {
        expect(isDeadAt(actor, 1.4)).toBe(false);
        expect(isDeadAt(actor, 1.6)).toBe(true);
        expect(isDeadAt(actor, 1.8)).toBe(false);
    });

    it('catches events across the loop seam', () => {
        expect(crossed(0.01, 4.99, 0.02)).toBe(true);
        expect(crossed(2, 4.99, 0.02)).toBe(false);
        expect(crossed(1, 0.9, 1.1)).toBe(true);
    });

    it('loops every mode seamlessly: each actor ends where it starts, every event inside the loop', () => {
        Object.values(LIVE_SCENES).forEach(({ script }) => {
            script.actors.forEach(a => {
                const first = a.keys[0], last = a.keys[a.keys.length - 1];
                expect(first.t).toBe(0);
                expect(last.t).toBe(script.duration);
                expect({ x: last.x, y: last.y }).toEqual({ x: first.x, y: first.y });
                a.shots?.forEach(s => expect(s.t).toBeLessThan(script.duration));
                if (a.death) expect(a.death.respawn).toBeLessThanOrEqual(script.duration);
            });
        });
    });

    it('names only actors that exist as targets and killers', () => {
        Object.values(LIVE_SCENES).forEach(({ script }) => {
            const ids = new Set(script.actors.map(a => a.id));
            script.actors.forEach(a => {
                a.shots?.forEach(s => expect(ids.has(s.target)).toBe(true));
                if (a.death) expect(ids.has(a.death.killer)).toBe(true);
            });
            script.texts?.forEach(x => expect(ids.has(x.actor)).toBe(true));
        });
    });
});

describe('script state', () => {
    const gunner: ActorScript = {
        ...actor,
        weapons: [{ t: 1, weapon: WeaponType.ROCKET_LAUNCHER }],
        carry: [{ from: 0.5, to: 1.5, team: Team.RED }],
        hide: { from: 1.9, to: 1.95 },
    };

    it('switches weapon at its time', () => {
        expect(weaponAt(gunner, 0.9)).toBe(WeaponType.MACHINE_GUN);
        expect(weaponAt(gunner, 1)).toBe(WeaponType.ROCKET_LAUNCHER);
    });

    it('carries only inside the window', () => {
        expect(carriedAt(gunner, 0.4)).toBe(Team.NONE);
        expect(carriedAt(gunner, 1)).toBe(Team.RED);
    });

    it('counts a hidden actor as off stage', () => {
        expect(isDeadAt(gunner, 1.92)).toBe(true);
    });

    it('shrinks the zone to tight mid-loop and reopens it at the seam', () => {
        const zone = { wide: { x: 0, y: 0, w: 100, h: 100 }, tight: { x: 20, y: 20, w: 60, h: 60 } };
        expect(zoneAt(zone, 0, 8)).toEqual(zone.wide);
        expect(zoneAt(zone, 4, 8).w).toBeCloseTo(60);
    });
});
