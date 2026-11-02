// Jetpack flame colours per flame id. Pure data: the simulation (server, Web Worker) reads the particle
// colour for the jetpack trail, so nothing here may import Pixi or the browser.

import type { FlameId } from '../../../build/buildParts';

export interface FlameColors {
    outer: number;    // the wide outer tongue (its edge)
    mid: number;      // the middle tongue
    core: number;     // the short hot core
    glow: number;     // tint of the soft light behind the body
    particle: string; // '#rrggbb' of the trail particles
    nozzle: number;   // the nozzle dot while the flame burns
}

export const FLAME_PALETTE: Readonly<Record<FlameId, Readonly<FlameColors>>> = Object.freeze({
    fire: { outer: 0xff8a1e, mid: 0xffe27a, core: 0xffffff, glow: 0xff9a3c, particle: '#fbbf24', nozzle: 0xffb347 },
    blue: { outer: 0x3b82f6, mid: 0xbfdbfe, core: 0xffffff, glow: 0x4f8cff, particle: '#60a5fa', nozzle: 0x93c5fd },
    green: { outer: 0x22c55e, mid: 0xd9f99d, core: 0xffffff, glow: 0x4ade80, particle: '#a3e635', nozzle: 0xa3e635 },
    purple: { outer: 0xa855f7, mid: 0xf5d0fe, core: 0xffffff, glow: 0xb46cff, particle: '#c084fc', nozzle: 0xd8b4fe },
    white: { outer: 0x93c5fd, mid: 0xf8fafc, core: 0xffffff, glow: 0xbfdbfe, particle: '#e0f2fe', nozzle: 0xe0f2fe },
});

/** The colours of a flame; fire for an id this client does not know (a newer or hostile host). */
export const flameColors = (id: FlameId): Readonly<FlameColors> => FLAME_PALETTE[id] ?? FLAME_PALETTE.fire;
