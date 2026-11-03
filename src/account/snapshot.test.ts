import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD } from '../game/build/buildParts';
import { FighterLook, PlayerSnapshot, mergeSnapshots, sanitizeSnapshot } from './snapshot';

const colors = { player: '#3b82f6', head: '#111111', torso: '#3b82f6', arms: '#222222', legs: '#475569', jetpack: '#ef4444' };
const look = (savedAt: number, skinId = 'classic'): FighterLook => ({ build: { ...DEFAULT_BUILD }, skinId, colors: { ...colors }, savedAt });
const snap = (partial: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({ achievements: {}, xp: 0, look: null, ...partial });

describe('mergeSnapshots', () => {
    const locked = snap({ achievements: { killer: { progress: 7, unlocked: false } } });
    const unlocked = snap({ achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 5 } } });

    it('takes max progress, unlocked and the unlock time, in either argument order', () => {
        const expected = { killer: { progress: 10, unlocked: true, unlockedAt: 5 } };
        expect(mergeSnapshots(locked, unlocked).achievements).toEqual(expected);
        expect(mergeSnapshots(unlocked, locked).achievements).toEqual(expected);
    });

    it('keeps the earliest unlockedAt and ignores a missing one', () => {
        const a = snap({ achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 9 } } });
        const b = snap({ achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 4 } } });
        expect(mergeSnapshots(a, b).achievements.killer.unlockedAt).toBe(4);
        expect(mergeSnapshots(a, snap({ achievements: { killer: { progress: 3, unlocked: false } } })).achievements.killer.unlockedAt).toBe(9);
    });

    it('unions the ids of both sides', () => {
        const other = snap({ achievements: { first_blood: { progress: 1, unlocked: true } } });
        expect(Object.keys(mergeSnapshots(locked, other).achievements).sort()).toEqual(['first_blood', 'killer']);
    });

    it('takes the larger xp', () => {
        expect(mergeSnapshots(snap({ xp: 120 }), snap({ xp: 80 })).xp).toBe(120);
        expect(mergeSnapshots(snap({ xp: 80 }), snap({ xp: 120 })).xp).toBe(120);
    });

    it('keeps the look with the larger savedAt, and any look beats null', () => {
        const older = look(1, 'old');
        const newer = look(2, 'new');
        expect(mergeSnapshots(snap({ look: older }), snap({ look: newer })).look?.skinId).toBe('new');
        expect(mergeSnapshots(snap({ look: newer }), snap({ look: older })).look?.skinId).toBe('new');
        expect(mergeSnapshots(snap({ look: null }), snap({ look: older })).look).toEqual(older);
        expect(mergeSnapshots(snap({ look: older }), snap({ look: null })).look).toEqual(older);
        expect(mergeSnapshots(snap(), snap()).look).toBeNull();
    });

    it('does not change its inputs or share objects with them', () => {
        const a = snap({ achievements: { killer: { progress: 7, unlocked: false } }, look: look(1) });
        const merged = mergeSnapshots(a, unlocked);
        merged.achievements.killer.progress = 99;
        expect(a.achievements.killer.progress).toBe(7);
        expect(unlocked.achievements.killer.progress).toBe(10);
        const copy = mergeSnapshots(a, snap());
        copy.look!.colors.head = '#000000';
        expect(a.look!.colors.head).toBe('#111111');
    });
});

describe('sanitizeSnapshot', () => {
    it('turns garbage into an empty snapshot', () => {
        expect(sanitizeSnapshot({ achievements: 'x', xp: -5, look: { build: 42 } })).toEqual({ achievements: {}, xp: 0, look: null });
        expect(sanitizeSnapshot(null)).toEqual({ achievements: {}, xp: 0, look: null });
        expect(sanitizeSnapshot('nope')).toEqual({ achievements: {}, xp: 0, look: null });
    });

    it('drops unknown achievement ids and malformed entries', () => {
        const result = sanitizeSnapshot({
            achievements: {
                removed_ach: { progress: 1, unlocked: true },
                killer: { progress: 4, unlocked: false },
                first_blood: { progress: 'many', unlocked: true },
                slayer: { progress: -1, unlocked: false },
                executioner: 'yes',
            },
        });
        expect(result.achievements).toEqual({ killer: { progress: 4, unlocked: false } });
    });

    it('keeps unlockedAt only when it is a valid number', () => {
        const result = sanitizeSnapshot({ achievements: {
            killer: { progress: 10, unlocked: true, unlockedAt: 5 },
            first_blood: { progress: 1, unlocked: true, unlockedAt: 'later' },
        } });
        expect(result.achievements.killer.unlockedAt).toBe(5);
        expect(result.achievements.first_blood).toEqual({ progress: 1, unlocked: true });
    });

    it('xp: non-finite or negative becomes 0, fractions are floored', () => {
        expect(sanitizeSnapshot({ xp: Infinity }).xp).toBe(0);
        expect(sanitizeSnapshot({ xp: NaN }).xp).toBe(0);
        expect(sanitizeSnapshot({ xp: '50' }).xp).toBe(0);
        expect(sanitizeSnapshot({ xp: 12.9 }).xp).toBe(12);
    });

    it('keeps a valid look and repairs the build field by field', () => {
        const raw = { ...look(7), build: { helmet: 'dome', ears: 'not-a-part' } };
        const result = sanitizeSnapshot({ look: raw }).look;
        expect(result?.build).toEqual({ ...DEFAULT_BUILD, helmet: 'dome' });
        expect(result?.savedAt).toBe(7);
        expect(result?.colors).toEqual(colors);
    });

    it('a look with a bad colour, skin or savedAt is null', () => {
        expect(sanitizeSnapshot({ look: { ...look(1), colors: { ...colors, head: 'red' } } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: { ...look(1), colors: { ...colors, jetpack: undefined } } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: { ...look(1), skinId: '' } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: { ...look(1), skinId: 5 } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: { ...look(1), savedAt: NaN } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: { ...look(1), savedAt: -1 } }).look).toBeNull();
        expect(sanitizeSnapshot({ look: null }).look).toBeNull();
    });
});
