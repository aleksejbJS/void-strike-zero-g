// Tuning numbers of the explosion and rocket-trail look (render/blast). Values were judged by the owner on the test
// range (#range, key 3) on 2026-11-18. Colours are 0xRRGGBB; sizes are px for a rocket blast (scale 1).

/** A blast's 'ring' particle is this big for a rocket: blast scale = ring size / this. */
export const RING_SIZE = 12;
export const MIN_SCALE = 0.4;            // smaller blasts are drawn at this scale
export const MAX_FIRE_SCALE = 1.6;       // the number of fireball puffs stops growing here

// Flash and fireball (additive flame puffs, the flame engine's textures)
export const FLASH = { ttl: 0.3, size0: 200, size1: 320, alpha: 0.85 };
export const FIRE_PUFFS = 22;            // per unit of scale (clamped to MIN_SCALE..MAX_FIRE_SCALE)
export const FIRE = {
    ttl: [0.45, 0.9], size0: [30, 46], size1: [70, 115], alpha: [0.75, 1],
    speed: [60, 320], spread: 14, drag: 5.5, rise: 160, lift: 40,
} as const;
export const FIRE_RAMP: readonly number[] = [0xfffbe8, 0xffd27a, 0xff8a2a, 0xd8461a, 0x4a1406];
export const FLASH_RAMP: readonly number[] = [0xfff1c8, 0xffa040, 0xff5a10];

// Blast smoke as an air grid (BlastCloud), drawn by the smoke shader
export const BLAST_BOX = 300;            // side of the grid box
export const BLAST_BELOW = 0.62;         // the blast point sits this far down the box: the smoke has room to rise
export const BLAST_GRID_SHARE = 0.85;    // grid cells per side = this * the smoke cloud grid of the quality
export const BLAST_CORE = 62;            // radius the smoke ball swells to
export const POUR_S = 0.35;              // the fireball pours smoke this long, the ball swelling from half to full size
export const POUR_DENS_PER_S = 14;       // density per second at the middle while it pours
export const POUR_HEAT_PER_S = 8;        // ... heat (the orange glow, and the lift)
export const POUR_SOOT_PER_S = 3;        // ... soot (darkens the grey)
export const THIN_START_PER_S = 0.15;    // the smoke thins at this rate at first, 1/s ...
export const THIN_END_PER_S = 0.95;      // ... rising to this by THIN_RAMP_S
export const THIN_RAMP_S = 2;
export const SWIRLS = 6;                 // random swirls per step while the smoke is young, so it rolls
export const SWIRL_S = 1.2;
export const SWIRL_SPEED = 170;          // px/s, fading out over SWIRL_S
export const SWIRL_RATE = 20;            // how fast the air follows a swirl, 1/s
export const BLAST_LIFE_S = 4;           // freed after this long at the latest ...
export const BLAST_FADE_S = 0.8;         // ... after fading out over this long, so the last thin smoke never pops away
export const BLAST_GONE_PEAK = 0.03;     // ... or once no cell is denser than this (after BLAST_MIN_S)
export const BLAST_MIN_S = 0.5;
export const BLAST_SMOKE: readonly [number, number, number] = [0.46, 0.44, 0.42];   // warm mid grey (linear RGB 0..1)
export const MAX_BLAST_GRIDS = 6;        // more blasts at once get the simple smoke puffs instead

// Simple blast smoke (soft sprites), where there is no grid: `low` quality, no shader, or too many blasts at once
export const SIMPLE_SMOKE_PUFFS = 9;
export const SIMPLE_SMOKE = { ttl: [1.2, 2], size0: [30, 50], size1: [80, 120], alpha: 0.5, spread: 30, drag: 2, rise: 30 } as const;
export const SIMPLE_SMOKE_RAMP: readonly number[] = [0x8a6a50, 0x4c4743, 0x3a3734];

// Rocket trail: a ribbon of soft smoke puffs from the tail, a hot glow at the nozzle
export const ROCKET_TAIL = 10;           // px behind the rocket's centre where the smoke comes out
export const TRAIL_STEP = 5;             // px between two trail puffs
export const TRAIL = { ttl: [1.4, 2.2], size0: [9, 13], size1: [44, 64], alpha: 0.36, jitter: 1.5, drift: 8, drag: 1.4, rise: 12, back: 0.002 } as const;
export const TRAIL_RAMP: readonly number[] = [0xe6ded2, 0xb0aca6, 0x8c8984];
export const NOZZLE = { ttl: 0.07, size0: 16, size1: 8, alpha: 0.9 };
export const NOZZLE_RAMP: readonly number[] = [0xfff0c0, 0xff9030];

// Debris flung by a blast trails thin dark smoke while it still flies fast
export const DEBRIS_STEP = 7;
export const DEBRIS_UNTIL_LIFE = 0.35;   // a chunk stops trailing when its life falls below this
export const DEBRIS = { ttl: [0.6, 1], size0: [5, 8], size1: [16, 24], alpha: 0.35, drag: 1, rise: 14 } as const;
export const DEBRIS_RAMP: readonly number[] = [0x6a625c, 0x4a4541];

export const JUMP = 400;                 // px: a trail point that moved farther in one frame jumped (no puffs across it)

// Sprite pools
export const SMOKE_CAP = 1000;
export const FIRE_CAP = 260;
export const FLASH_CAP = 12;
