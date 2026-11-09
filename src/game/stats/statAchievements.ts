// How lifetime counters feed achievements, and how counters are first filled from existing achievement progress.

import { PHYSICS_TICK_RATE } from '../../constants';
import type { AchievementProgress } from '../systems/achievementDefs';
import type { StatKey, Stats } from './statKeys';

interface Rule {
    ids: readonly string[];
    /** Counter units per achievement unit (ticks per second, ms per second); absent means one-to-one. */
    perUnit?: number;
}

const KILL_IDS = ['first_blood', 'killer', 'slayer', 'executioner'] as const;

const RULES: Record<StatKey, Rule> = {
    kills: { ids: KILL_IDS },
    botKills: { ids: KILL_IDS },
    chainsawKills: { ids: ['chainsaw_master'] },
    railgunKills: { ids: ['sniper'] },
    rocketKills: { ids: ['demolition_expert'] },
    flagCaptures: { ids: ['flag_capturer'] },
    flagHoldTicks: { ids: ['king_of_hill'], perUnit: PHYSICS_TICK_RATE },
    hookUses: { ids: ['hook_master'] },
    itemPickups: { ids: ['collector', 'hoarder'] },
    hungerWins: { ids: ['survivor'] },
    playMs: { ids: ['veteran'], perUnit: 1000 },
    wins: { ids: [] },
    botWins: { ids: [] },
    tournamentsWon: { ids: [] },
};

/** Achievement progress to add when a counter moves from `before` to `after`. Zero or negative steps are dropped. */
export function achievementIncrements(key: StatKey, before: number, after: number): Array<[string, number]> {
    const { ids, perUnit } = RULES[key];
    const step = perUnit === undefined
        ? after - before
        : Math.floor(after / perUnit) - Math.floor(before / perUnit);
    return step > 0 ? ids.map((id): [string, number] => [id, step]) : [];
}

/** Counters worked out from achievement progress, used once when no counters are stored yet. */
export function seedStatsFromAchievements(p: AchievementProgress): Stats {
    const progress = (id: string): number => p[id]?.progress ?? 0;
    const most = (ids: readonly string[]): number => Math.max(0, ...ids.map(progress));
    return {
        kills: 0,
        wins: 0,
        botWins: 0,
        botKills: most(KILL_IDS),
        chainsawKills: progress('chainsaw_master'),
        railgunKills: progress('sniper'),
        rocketKills: progress('demolition_expert'),
        flagCaptures: progress('flag_capturer'),
        flagHoldTicks: progress('king_of_hill') * PHYSICS_TICK_RATE,
        hungerWins: progress('survivor'),
        hookUses: progress('hook_master'),
        itemPickups: most(['collector', 'hoarder']),
        playMs: progress('veteran') * 1000,
        tournamentsWon: p.tournament_champion?.unlocked ? 1 : 0,
    };
}
