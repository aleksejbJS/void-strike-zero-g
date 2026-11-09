import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD } from '../game/build/buildParts';
import { FighterLook, PlayerSnapshot, mergeSnapshots, sanitizeSnapshot } from './snapshot';

const colors = { player: '#3b82f6', head: '#111111', torso: '#3b82f6', arms: '#222222', legs: '#475569', jetpack: '#ef4444' };
const look = (savedAt: number, skinId = 'classic'): FighterLook => ({ build: { ...DEFAULT_BUILD }, skinId, colors: { ...colors }, savedAt });
const snap = (partial: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({ achievements: {}, xp: 0, look: null, stats: {}, ...partial });

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

    it('a savedAt tie keeps the second argument (the cloud copy)', () => {
        expect(mergeSnapshots(snap({ look: look(5, 'local') }), snap({ look: look(5, 'cloud') })).look?.skinId).toBe('cloud');
    });

    it('stats: takes the larger value of each counter and unions the keys, in either argument order', () => {
        const a = snap({ stats: { kills: 5, wins: 1 } });
        const b = snap({ stats: { kills: 3, botWins: 2 } });
        const expected = { kills: 5, wins: 1, botWins: 2 };
        expect(mergeSnapshots(a, b).stats).toEqual(expected);
        expect(mergeSnapshots(b, a).stats).toEqual(expected);
        expect(mergeSnapshots(a, snap()).stats).toEqual({ kills: 5, wins: 1 });
    });

    it('stats: carries a counter this build does not know, and never lowers one', () => {
        const merged = mergeSnapshots(snap({ stats: { kills: 2 } }), snap({ stats: { kills: 0, futureStat: 9 } as PlayerSnapshot['stats'] }));
        expect(merged.stats).toEqual({ kills: 2, futureStat: 9 });
    });

    it('stats: a merged snapshot shares no object with its inputs', () => {
        const a = snap({ stats: { kills: 5 } });
        const merged = mergeSnapshots(a, snap({ stats: { wins: 1 } }));
        merged.stats.kills = 99;
        expect(a.stats.kills).toBe(5);
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
        expect(sanitizeSnapshot({ achievements: 'x', xp: -5, look: { build: 42 } })).toEqual({ achievements: {}, xp: 0, look: null, stats: {} });
        expect(sanitizeSnapshot(null)).toEqual({ achievements: {}, xp: 0, look: null, stats: {} });
        expect(sanitizeSnapshot('nope')).toEqual({ achievements: {}, xp: 0, look: null, stats: {} });
    });

    it('keeps well-formed unknown achievement ids (a newer build), drops malformed ids and entries', () => {
        const result = sanitizeSnapshot({
            achievements: {
                future_ach: { progress: 1, unlocked: true },
                killer: { progress: 4, unlocked: false },
                first_blood: { progress: 'many', unlocked: true },
                slayer: { progress: -1, unlocked: false },
                executioner: 'yes',
                'Bad Id': { progress: 1, unlocked: true },
                ['x'.repeat(41)]: { progress: 1, unlocked: true },
                constructor: { progress: 1, unlocked: true },
            },
        });
        expect(result.achievements).toEqual({ future_ach: { progress: 1, unlocked: true }, killer: { progress: 4, unlocked: false } });
    });

    it('keeps at most 200 achievement entries', () => {
        const many = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`a${i}`, { progress: 1, unlocked: false }]));
        expect(Object.keys(sanitizeSnapshot({ achievements: many }).achievements)).toHaveLength(200);
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

    it('stats: a missing or malformed record becomes {}', () => {
        expect(sanitizeSnapshot({}).stats).toEqual({});
        expect(sanitizeSnapshot({ stats: 'many' }).stats).toEqual({});
        expect(sanitizeSnapshot({ stats: [1, 2] }).stats).toEqual({});
        expect(sanitizeSnapshot({ stats: null }).stats).toEqual({});
    });

    it('stats: drops negative, non-numeric and non-finite values, floors fractions', () => {
        const result = sanitizeSnapshot({ stats: { kills: -1, botKills: 'x', wins: 2.7, botWins: Infinity, hookUses: NaN, playMs: 1234.99, itemPickups: 0 } });
        expect(result.stats).toEqual({ wins: 2, playMs: 1234, itemPickups: 0 });
    });

    it('stats: keeps well-formed unknown counters (a newer build), drops malformed or unsafe keys', () => {
        // JSON.parse makes "__proto__" a real own key, as it would be in a cloud row
        const raw = JSON.parse('{"kills":4,"futureStat":7,"__proto__":5,"constructor":3,"toString":2,"bad_key":1,"with space":1,"stat9":1,"":1}');
        expect(sanitizeSnapshot({ stats: raw }).stats).toEqual({ kills: 4, futureStat: 7 });
        expect(sanitizeSnapshot({ stats: { ['x'.repeat(41)]: 1, ['y'.repeat(40)]: 2 } }).stats).toEqual({ ['y'.repeat(40)]: 2 });
    });

    it('stats: keeps at most 60 counters', () => {
        const many = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`stat${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, i]));
        expect(Object.keys(sanitizeSnapshot({ stats: many }).stats)).toHaveLength(60);
    });

    it('keeps a valid look, repairs malformed build fields and carries well-formed unknown ones', () => {
        const raw = { ...look(7), build: { helmet: 'dome', ears: 'newer_part', tail: { x: 1 }, visor: 'a b', cape: 'red', ['bad key']: 'x' } };
        const result = sanitizeSnapshot({ look: raw }).look;
        expect(result?.build).toEqual({ ...DEFAULT_BUILD, helmet: 'dome', ears: 'newer_part', cape: 'red' });
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
