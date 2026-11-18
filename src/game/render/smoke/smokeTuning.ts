// Tuning numbers of the smoke air simulation. Starting values are the ones from the owner-approved
// spike; the later tasks retune them on the test range (#range, key 7).

export type SmokeQuality = 'high' | 'medium' | 'low';

/** Grid cells per side for each quality tier (the game screen, touch devices, match tiles and the menu). */
export const GRID_N: Record<SmokeQuality, number> = { high: 48, medium: 32, low: 24 };

export const STEP_HZ = 60;               // fixed simulation steps per second, whatever the frame rate
export const MAX_CATCHUP_STEPS = 3;      // most steps one frame may run to catch up after a hitch
export const PRESSURE_ITERS = 18;        // Gauss-Seidel sweeps per pressure solve
export const VORTICITY = 3.5;            // vorticity confinement strength: keeps small swirls alive
export const BUOYANCY = 260;             // upward acceleration of fully hot air, px/s^2 per unit of heat
export const DAMP_PER_S = 0.9;           // air velocity drag, 1/s
export const COOL_PER_S = 3.2;           // heat decay rate, 1/s (a flame glow fades in well under a second)
export const HEAT_MAX = 1.5;             // heat a stir can pile up in one cell
export const SOOT_MAX = 1;               // soot a stir can pile up in one cell (1 = near black)
export const MAX_STIR_SPEED = 1200;      // px/s: a stir never drives the air faster than this
