// Names of the lifetime counters. A counter only ever grows; unlike an achievement it has no target.

export const STAT_KEYS = [
    'kills', 'botKills', 'chainsawKills', 'railgunKills', 'rocketKills',
    'flagCaptures', 'flagHoldTicks', 'hungerWins', 'hookUses', 'itemPickups',
    'playMs', 'wins', 'botWins', 'tournamentsWon',
] as const;

export type StatKey = typeof STAT_KEYS[number];

export type Stats = Partial<Record<StatKey, number>>;

/** Counters the simulation reports during a match; the rest (wins, play time, ...) are added outside it. */
export const SIM_STAT_KEYS: readonly StatKey[] = [
    'kills', 'botKills', 'chainsawKills', 'railgunKills', 'rocketKills',
    'flagCaptures', 'flagHoldTicks', 'hookUses', 'itemPickups',
];
