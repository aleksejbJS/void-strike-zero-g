// Tuning numbers of the smoke air simulation. Starting values are the ones from the owner-approved
// spike; the later tasks retune them on the test range (#range, key 7).

export type SmokeQuality = 'high' | 'medium' | 'low';

/** Grid cells per side for each quality tier (the game screen, touch devices, match tiles and the menu). */
export const GRID_N: Record<SmokeQuality, number> = { high: 48, medium: 32, low: 24 };

export const STEP_HZ = 60;               // fixed simulation steps per second, whatever the frame rate
export const VIEW_MARGIN = 200;          // px: a grid this far outside the view still steps, so it is ready when it comes in
export const MAX_CATCHUP_STEPS = 3;      // most steps one frame may run to catch up after a hitch
export const PRESSURE_ITERS = 18;        // Gauss-Seidel sweeps per pressure solve
export const VORTICITY = 3.5;            // vorticity confinement strength: keeps small swirls alive
export const BUOYANCY = 260;             // upward acceleration of fully hot air, px/s^2 per unit of heat
export const DAMP_PER_S = 0.9;           // air velocity drag, 1/s
export const COOL_PER_S = 3.2;           // heat decay rate, 1/s (a flame glow fades in well under a second)
export const HEAT_MAX = 1.5;             // heat a stir can pile up in one cell
export const SOOT_MAX = 1;               // soot a stir can pile up in one cell (1 = near black)
export const DENS_MAX = 1.2;             // smoke density a stir can pile up in one cell (a settled cloud peaks at TARGET_PEAK)
export const MAX_STIR_SPEED = 1200;      // px/s: a stir never drives the air faster than this
export const IMPULSE_DT = 1 / 60;        // s of effect one point of a travelling or one-shot stir (shot chain, blast, beam) carries
export const MAX_STIR_FRAME_DT = 0.1;    // s: a continuous stir (fighter, flame stream) carries the frame's real time, but never more than this

// Cloud shaping (CloudShaper): how a grid is made to behave like a grenade cloud
export const GROW_PER_S = 5;             // the cloud's reach closes on the live radius as 1 - exp(-age * this)
export const BURST_SPEED = 420;          // outward air speed scale at birth, px/s
export const BURST_DECAY_PER_S = 3;      // the burst fades as exp(-age * this)
export const BURST_GAIN = 4;             // outward acceleration = this * burst speed, px/s^2 per px/s
export const BURST_MIN_SPEED = 5;        // below this speed the burst is over
export const TARGET_PEAK = 1.15;         // settled density in the middle of the cloud; falls to 0 at the edge as 1 - q^2
export const FAST_REFILL_S = 0.6;        // the cloud's first seconds refill fast: the burst has this long
export const REFILL_FAST_PER_S = 8;      // density closes on its target at this rate while the cloud is young, 1/s
export const REFILL_SLOW_PER_S = 1.7;    // ... and at this rate afterwards (holes closed in 1-2 s)
export const FADE_OUTSIDE_PER_S = 3.5;   // density outside the live radius fades at this rate, 1/s
/** Angular waves of the outline: `waves` lobes around the circle, `amp` of the radius, `drift` rad/s of slow turning. */
export const OUTLINE_WAVES: readonly { waves: number; amp: number; drift: number }[] = [
    { waves: 3, amp: 0.16, drift: 0.25 }, { waves: 5, amp: 0.1, drift: -0.35 }, { waves: 8, amp: 0.06, drift: 0.5 },
];
export const CHURN_STIRS = 5;            // random stirs per step so the cloud never sits still
export const CHURN_REACH_CELLS = 5;      // reach of one churn stir, in cells
export const CHURN_SPEED = 100;          // a churn stir drives the air at up to +-this, px/s (both axes)
export const CHURN_RISE_BIAS = 0.1;      // share of the speed range that tilts the vertical push upward (up to -120 / +80)
export const CHURN_RATE = 21;            // how fast the air follows a churn stir, 1/s (the spike's 0.3 per 60 Hz step)

// Soot plumes (SootPlumes): the flamethrower's smoke, drawn as small air grids with no gameplay circle
export const PLUME_BOX = 180;            // px, side of a plume's box
export const PLUME_EMIT_AT = 0.7;        // the soot point that makes a plume sits this far down the box (0 top, 1 bottom): soot rises inside it
export const PLUME_EDGE = 0.14;          // the shader fades a quad out over this share of its side at every edge: a plume holds no soot there
export const PLUME_CAP: Record<SmokeQuality, number> = { high: 6, medium: 3, low: 0 };   // most plumes alive at once (low keeps the sprites)
export const PLUME_FULL_RATE = 3;        // plumes nearest the view centre that step every frame, the others at half rate
export const PLUME_SOOT_PER_S = 2.5;     // soot one live flame smoke particle deposits per second at its centre
export const PLUME_HEAT_PER_S = 1;       // ... and heat, which makes the soot rise
export const PLUME_DENS_PER_S = 2.4;     // ... and smoke density, which is what the shader draws
export const PLUME_REACH_CELLS = 1;      // reach of one deposit, in cells (its kernel weighs about 1: a particle adds its rate in all)
export const PLUME_DECAY_PER_S = 0.6;    // plume density fades at this rate, 1/s
export const PLUME_IDLE_S = 1;           // a plume with no deposit for this long and ...
export const PLUME_MIN_MASS = 0.5;       // ... less smoke than this (cell units) is destroyed

// Smoke look (SmokeQuad shader). Colours are linear RGB in 0..1.
export const SMOKE_WHITE: readonly [number, number, number] = [0.86, 0.87, 0.89];   // base aerosol colour of a grenade cloud
export const SMOKE_SOOT: readonly [number, number, number] = [0.05, 0.045, 0.04];    // near-black: the aerosol darkens toward this as soot piles up (the range wall is about 0.13)
export const FIELD_RANGE = 1.5;          // density and heat that fill the texture byte (255); the shader multiplies back by this
export const NOISE_SCALE_PX = 34;        // world pixels per unit of the billow noise: sets the size of the billows
