// Flag colours: main fill, dark for folds in shadow, light for highlights, emblem and crystal.

import { Entity, GameMode, Team } from '../../../types';

export interface FlagPalette {
    main: number;
    dark: number;
    light: number;
}

export const FLAG_PALETTES = {
    blue: { main: 0x3b82f6, dark: 0x1e3a8a, light: 0x93c5fd },
    red: { main: 0xef4444, dark: 0x7f1d1d, light: 0xfca5a5 },
    neutral: { main: 0xf59e0b, dark: 0x92400e, light: 0xfde68a }, // Hold the Flag
    intel: { main: 0xfacc15, dark: 0x854d0e, light: 0xfef08a },   // Infiltration intel on a carrier's back
} satisfies Record<string, FlagPalette>;

/** Colours of a flag lying on the map, by the team that owns it. */
export const flagPaletteFor = (team: Team | undefined): FlagPalette =>
    team === Team.BLUE ? FLAG_PALETTES.blue : team === Team.RED ? FLAG_PALETTES.red : FLAG_PALETTES.neutral;

/** Colours of what a fighter carries; `hasFlag` means different things per mode. */
export const carriedPaletteFor = (p: Entity, mode: GameMode): FlagPalette => {
    if (mode === GameMode.HOLD_THE_FLAG) return FLAG_PALETTES.neutral;
    if (mode === GameMode.INFILTRATION) return FLAG_PALETTES.intel;
    return flagPaletteFor(p.hasFlag);
};

/** Linear mix of two 0xRRGGBB colours. */
export const mixColor = (a: number, b: number, t: number): number => {
    const ch = (shift: number) => {
        const x = (a >> shift) & 0xff;
        const y = (b >> shift) & 0xff;
        return Math.round(x + (y - x) * t) << shift;
    };
    return ch(16) | ch(8) | ch(0);
};
