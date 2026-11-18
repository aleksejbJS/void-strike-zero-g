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
