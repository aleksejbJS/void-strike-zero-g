// Fighter build model: the part catalogue per slot and the build a player wears.
// Pure data, no browser or React imports, so the server can import it too.

export const HELMETS = ['round', 'box', 'dome', 'angular'] as const;
export const VISORS = ['strip', 'glass', 'slit', 't', 'eyes'] as const;
export const EARS = ['none', 'cat', 'antennae', 'wolf', 'bunny', 'round', 'horns', 'ram', 'lamp', 'crest'] as const;
export const TAILS = ['none', 'cat', 'tentacle', 'lizard', 'mech'] as const;
export const JETPACKS = ['pack', 'tanks', 'rocket', 'wings', 'scrap'] as const;
export const FLAMES = ['fire', 'blue', 'green', 'purple', 'white'] as const;
export const PATTERNS = ['none', 'band', 'stripes', 'hazard', 'camo', 'split'] as const;
export const BADGES = ['none', 'chevron', 'number', 'emblem'] as const;
export const EMBLEMS = ['skull', 'star', 'bolt'] as const;

export type HelmetId = typeof HELMETS[number];
export type VisorId = typeof VISORS[number];
export type EarsId = typeof EARS[number];
export type TailId = typeof TAILS[number];
export type JetpackId = typeof JETPACKS[number];
export type FlameId = typeof FLAMES[number];
export type PatternId = typeof PATTERNS[number];
export type BadgeId = typeof BADGES[number];
export type EmblemId = typeof EMBLEMS[number];

// Slots whose part is picked from a list. Emblem, badge number and colours are extras.
export const SLOTS = {
    helmet: HELMETS,
    visor: VISORS,
    ears: EARS,
    tail: TAILS,
    jetpack: JETPACKS,
    flame: FLAMES,
    pattern: PATTERNS,
    badge: BADGES,
} as const;

export type Slot = keyof typeof SLOTS;

export interface FighterBuild {
    helmet: HelmetId;
    visor: VisorId;
    ears: EarsId;
    tail: TailId;
    jetpack: JetpackId;
    flame: FlameId;
    pattern: PatternId;
    badge: BadgeId;
    badgeNumber: number; // 0..99, shown by the 'number' badge
    emblem: EmblemId;    // shown by the 'emblem' badge
    visorColor: string;  // '#rrggbb'
    patternColor: string; // '#rrggbb'
}

export const DEFAULT_BUILD: FighterBuild = Object.freeze({
    helmet: 'round',
    visor: 'strip',
    ears: 'none',
    tail: 'none',
    jetpack: 'pack',
    flame: 'fire',
    pattern: 'none',
    badge: 'none',
    badgeNumber: 7,
    emblem: 'skull',
    visorColor: '#7fd3ff',
    patternColor: '#e5e7eb',
});
