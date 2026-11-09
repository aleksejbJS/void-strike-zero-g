import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD, SLOTS, Slot } from './buildParts';
import {
    FREE_PARTS, UNLOCK_ORDER, XP_PER_LEVEL, enforceUnlocks, isUnlocked, levelForXp, unlockLevel, unlockedBetween,
} from './unlocks';

describe('unlocks', () => {
    it('has 30 items', () => {
        expect(UNLOCK_ORDER).toHaveLength(30);
    });

    it('first item is wolf ears at level 2, last is crest at level 31', () => {
        expect(UNLOCK_ORDER[0]).toEqual({ slot: 'ears', id: 'wolf', source: 'level', level: 2 });
        expect(UNLOCK_ORDER[29]).toEqual({ slot: 'ears', id: 'crest', source: 'level', level: 31 });
    });

    it('every slot id in the order exists in SLOTS and none is free', () => {
        for (const item of UNLOCK_ORDER) {
            expect(SLOTS[item.slot] as readonly string[]).toContain(item.id);
            expect(FREE_PARTS[item.slot]).not.toContain(item.id);
        }
    });

    it('free and unlockable parts together cover every part exactly once', () => {
        for (const slot of Object.keys(SLOTS) as Slot[]) {
            const locked = UNLOCK_ORDER.filter(i => i.slot === slot).map(i => i.id);
            expect([...FREE_PARTS[slot], ...locked].sort()).toEqual([...SLOTS[slot]].sort());
        }
    });

    it('opens item k at level k + 1', () => {
        UNLOCK_ORDER.forEach((item, index) => expect(item.level).toBe(index + 2));
    });

    it('levelForXp(0)=1, (49)=1, (50)=2, (1500)=31', () => {
        expect(XP_PER_LEVEL).toBe(50);
        expect(levelForXp(0)).toBe(1);
        expect(levelForXp(49)).toBe(1);
        expect(levelForXp(50)).toBe(2);
        expect(levelForXp(1500)).toBe(31);
    });

    it('unlockLevel is 1 for free parts and the item level otherwise', () => {
        expect(FREE_PARTS.helmet).toContain('none');
        expect(FREE_PARTS.visor).toContain('none');
        expect(isUnlocked('helmet', 'none', 1)).toBe(true);
        expect(isUnlocked('visor', 'none', 1)).toBe(true);
        expect(unlockLevel('helmet', 'box')).toBe(1);
        expect(unlockLevel('ears', 'wolf')).toBe(2);
        expect(unlockLevel('tail', 'lizard')).toBe(4);
    });

    it('isUnlocked compares the level with the part level', () => {
        expect(isUnlocked('tail', 'lizard', 3)).toBe(false);
        expect(isUnlocked('tail', 'lizard', 4)).toBe(true);
        expect(isUnlocked('flame', 'fire', 1)).toBe(true);
    });

    it('unlockedBetween(1, 3) returns wolf ears and full-glass visor', () => {
        expect(unlockedBetween(1, 3).map(i => `${i.slot}:${i.id}`)).toEqual(['ears:wolf', 'visor:glass']);
        expect(unlockedBetween(3, 3)).toEqual([]);
    });

    it('enforceUnlocks swaps a locked tail for none at level 1 and keeps it at level 4', () => {
        const build = { ...DEFAULT_BUILD, tail: 'lizard' as const };
        expect(enforceUnlocks(build, 1).tail).toBe('none');
        expect(enforceUnlocks(build, 4).tail).toBe('lizard');
    });

    it('enforceUnlocks returns a fresh copy and leaves free parts and extras alone', () => {
        const build = { ...DEFAULT_BUILD, helmet: 'box' as const, badgeNumber: 42, pattern: 'camo' as const };
        const result = enforceUnlocks(build, 1);
        expect(result).not.toBe(build);
        expect(result).toEqual({ ...build, pattern: 'none' });
    });
});
