import { describe, it, expect } from 'vitest';
import { STAT_KEYS, SIM_STAT_KEYS } from './statKeys';
import { achievementIncrements, seedStatsFromAchievements } from './statAchievements';

describe('achievementIncrements', () => {
    it('feeds all four kill achievements from bot kills', () => {
        const result = achievementIncrements('botKills', 99, 101);
        expect(result).toContainEqual(['executioner', 2]);
        expect(result).toContainEqual(['first_blood', 2]);
        expect(result.map(([id]) => id)).toEqual(['first_blood', 'killer', 'slayer', 'executioner']);
    });

    it('feeds the same kill achievements from player kills', () => {
        expect(achievementIncrements('kills', 0, 3).map(([id]) => id))
            .toEqual(['first_blood', 'killer', 'slayer', 'executioner']);
    });

    it.each([
        ['chainsawKills', 'chainsaw_master'],
        ['railgunKills', 'sniper'],
        ['rocketKills', 'demolition_expert'],
        ['flagCaptures', 'flag_capturer'],
        ['hookUses', 'hook_master'],
        ['hungerWins', 'survivor'],
    ] as const)('%s feeds %s one-to-one', (key, id) => {
        expect(achievementIncrements(key, 4, 9)).toEqual([[id, 5]]);
    });

    it('item pickups feed collector and hoarder', () => {
        expect(achievementIncrements('itemPickups', 0, 2)).toEqual([['collector', 2], ['hoarder', 2]]);
    });

    it('flag hold ticks become whole seconds of king_of_hill', () => {
        expect(achievementIncrements('flagHoldTicks', 119, 121)).toEqual([['king_of_hill', 1]]);
    });

    it('play time becomes whole seconds of veteran and drops a zero increment', () => {
        expect(achievementIncrements('playMs', 1500, 1900)).toEqual([]);
        expect(achievementIncrements('playMs', 1500, 2100)).toEqual([['veteran', 1]]);
    });

    it('wins, bot wins and tournaments won feed no achievement', () => {
        expect(achievementIncrements('wins', 0, 5)).toEqual([]);
        expect(achievementIncrements('botWins', 0, 5)).toEqual([]);
        expect(achievementIncrements('tournamentsWon', 0, 1)).toEqual([]);
    });

    it('never returns a negative increment', () => {
        expect(achievementIncrements('kills', 5, 3)).toEqual([]);
    });
});

describe('seedStatsFromAchievements', () => {
    it('turns achievement progress into counters', () => {
        const stats = seedStatsFromAchievements({
            executioner: { progress: 100, unlocked: true },
            veteran: { progress: 7, unlocked: false },
        });
        expect(stats.botKills).toBe(100);
        expect(stats.kills).toBe(0);
        expect(stats.playMs).toBe(7000);
    });

    it('takes the highest kill achievement and the highest pickup achievement', () => {
        const stats = seedStatsFromAchievements({
            first_blood: { progress: 1, unlocked: true },
            killer: { progress: 8, unlocked: false },
            collector: { progress: 30, unlocked: false },
            hoarder: { progress: 12, unlocked: false },
        });
        expect(stats.botKills).toBe(8);
        expect(stats.itemPickups).toBe(30);
    });

    it('converts king_of_hill seconds into ticks and carries the one-to-one counters', () => {
        const stats = seedStatsFromAchievements({
            king_of_hill: { progress: 3, unlocked: false },
            chainsaw_master: { progress: 4, unlocked: false },
            sniper: { progress: 5, unlocked: false },
            demolition_expert: { progress: 6, unlocked: false },
            flag_capturer: { progress: 7, unlocked: false },
            survivor: { progress: 2, unlocked: false },
            hook_master: { progress: 9, unlocked: false },
        });
        expect(stats).toMatchObject({
            flagHoldTicks: 360, chainsawKills: 4, railgunKills: 5, rocketKills: 6,
            flagCaptures: 7, hungerWins: 2, hookUses: 9,
        });
    });

    it('counts a tournament championship as one tournament won', () => {
        expect(seedStatsFromAchievements({ tournament_champion: { progress: 1, unlocked: true } }).tournamentsWon).toBe(1);
        expect(seedStatsFromAchievements({ tournament_champion: { progress: 0, unlocked: false } }).tournamentsWon).toBe(0);
    });

    it('seeds every counter, with zero for wins and player kills', () => {
        const stats = seedStatsFromAchievements({});
        expect(Object.keys(stats).sort()).toEqual([...STAT_KEYS].sort());
        expect(stats).toMatchObject({ kills: 0, wins: 0, botWins: 0 });
    });
});

describe('SIM_STAT_KEYS', () => {
    it('lists the counters the simulation reports', () => {
        expect([...SIM_STAT_KEYS].sort()).toEqual([
            'botKills', 'chainsawKills', 'flagCaptures', 'flagHoldTicks',
            'hookUses', 'itemPickups', 'kills', 'railgunKills', 'rocketKills',
        ]);
    });
});
