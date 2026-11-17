// Colours of the drawn flame: four palettes from the owner's demo and the look-up tables built from them.
// Only napalm is used for now; the others wait for fighter-builder unlocks.

export type FlamePaletteId = 'napalm' | 'gas' | 'toxic' | 'crimson';

interface Palette {
    ramp: [number, number][];  // (share of a core's life, colour): white-hot at birth to dark ember
    jet: [number, number];     // nozzle streak, born → dying
    pilot: number;
    spark: number;
    smoke: [number, number];
    glow: number;
}

export const PALETTES: Record<FlamePaletteId, Palette> = {
    napalm: { ramp: [[0, 0xfff7dd], [0.13, 0xffdf8a], [0.33, 0xffab38], [0.56, 0xff6a1c], [0.78, 0xdd2f12], [1, 0x471007]], jet: [0xe8f4ff, 0xfff2bd], pilot: 0x86c5ff, spark: 0xffd47e, smoke: [0x6b5a4a, 0x3c3a38], glow: 0xff7a26 },
    gas: { ramp: [[0, 0xf2ffff], [0.14, 0xbfeaff], [0.34, 0x63c4ff], [0.58, 0x2f7bff], [0.8, 0x2740a8], [1, 0x0a1236]], jet: [0xffffff, 0xd8f2ff], pilot: 0x9fd8ff, spark: 0xbfe6ff, smoke: [0x4c5a66, 0x323a44], glow: 0x3f9dff },
    toxic: { ramp: [[0, 0xf6ffe4], [0.14, 0xd8ff8a], [0.34, 0x8dff3a], [0.58, 0x3fe24e], [0.8, 0x0f8a3c], [1, 0x06301c]], jet: [0xf0ffe0, 0xd8ffb0], pilot: 0xa8ff6e, spark: 0xd8ff8a, smoke: [0x4e5c46, 0x333c34], glow: 0x52e838 },
    crimson: { ramp: [[0, 0xffe9e2], [0.14, 0xffb09a], [0.34, 0xff5a3c], [0.58, 0xe01f3d], [0.8, 0x8a1030], [1, 0x2b0412]], jet: [0xffe8e0, 0xffc9b0], pilot: 0xff9a8a, spark: 0xffb09a, smoke: [0x5c4a4a, 0x3a3236], glow: 0xff3050 },
};

/** Ready-made colour tables: 64 steps of the core ramp, 16 steps of the rest. */
export interface FlameColors {
    ramp: Uint32Array;
    jet: Uint32Array;
    pilot: Uint32Array;
    smoke: Uint32Array;
    spark: Uint32Array;
    glow: number;
    pilotGlow: number;
}

export const RAMP_STEPS = 64;
export const LUT_STEPS = 16;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Linear blend of two 0xRRGGBB colours; t = 0 gives `a`, t = 1 gives `b`. */
export const mixColor = (a: number, b: number, t: number): number => {
    const k = clamp01(t);
    const ch = (shift: number) => {
        const x = (a >> shift) & 0xff, y = (b >> shift) & 0xff;
        return (Math.round(x + (y - x) * k) & 0xff) << shift;
    };
    return ch(16) | ch(8) | ch(0);
};

const rampAt = (ramp: Palette['ramp'], t: number): number => {
    for (let k = 0; k < ramp.length - 1; k++) {
        const [t0, c0] = ramp[k], [t1, c1] = ramp[k + 1];
        if (t >= t0 && t <= t1) return mixColor(c0, c1, (t - t0) / Math.max(1e-5, t1 - t0));
    }
    return ramp[ramp.length - 1][1];
};

const table = (steps: number, color: (u: number) => number): Uint32Array => {
    const out = new Uint32Array(steps);
    for (let i = 0; i < steps; i++) out[i] = color(i / (steps - 1));
    return out;
};

export const buildColors = (id: FlamePaletteId): FlameColors => {
    const p = PALETTES[id];
    const ramp = table(RAMP_STEPS, t => rampAt(p.ramp, t));
    return {
        ramp,
        jet: table(LUT_STEPS, u => mixColor(p.jet[0], p.jet[1], u)),
        pilot: table(LUT_STEPS, u => mixColor(p.pilot, p.jet[1], u)),
        smoke: table(LUT_STEPS, u => mixColor(p.smoke[0], p.smoke[1], u)),
        spark: table(LUT_STEPS, u => mixColor(p.spark, ramp[52], u)),
        glow: p.glow,
        pilotGlow: p.pilot,
    };
};

/** Index into a table of `steps` entries for share `t` (clamped). */
export const lutIndex = (t: number, steps: number): number => Math.floor(clamp01(t) * (steps - 1));
