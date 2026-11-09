// Sounds of the flamethrower, synthesised with Web Audio like coverAudio.ts. The simulation announces them
// as SOUND events {sound: 'flame', subtype: 'spray' | 'ignite'}: a spray comes with every flame tick
// (10 per second) and its bursts overlap into one roar; an ignite is a fuel tank catching fire, a whoomp
// and then a hiss that rises for the whole fuse, right up to the blast.

import { sfxOutput } from './audio';
import { whiteNoise } from './coverAudio';
import { TANK_FUSE_MS } from './flameConstants';

export type FlameSound = 'spray' | 'ignite';
type Bus = NonNullable<ReturnType<typeof sfxOutput>>;

/** Seconds between two sprays: several fighters spraying at once merge into one roar instead of piling up. */
const SPRAY_GAP = 0.05;
/** A spray burst is longer than the 100 ms between ticks, so the bursts overlap. */
const SPRAY_DUR = 0.18;
const FUSE_S = TANK_FUSE_MS / 1000;
const FLOOR = 0.001; // an exponential ramp cannot reach 0

let lastSpray = -Infinity;

/** Filtered noise from `at` s for `dur` s; the volume goes `vol` → `volEnd` (linear), then cuts to silence. */
const noise = (bus: Bus, at: number, dur: number, vol: number, volEnd: number, filterType: BiquadFilterType, freq: number, freqEnd = freq) => {
    const { ctx, out } = bus, t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = whiteNoise(ctx);
    src.loop = true; // the fuse hiss is longer than the 1 s noise buffer
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.linearRampToValueAtTime(volEnd, t0 + dur * 0.97);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(out);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur);
};

/** A tone sliding from `freq` to `freqEnd`, its volume rising from `vol` to `volEnd`. */
const tone = (bus: Bus, dur: number, vol: number, volEnd: number, freq: number, freqEnd: number) => {
    const { ctx, out } = bus, t0 = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.linearRampToValueAtTime(volEnd, t0 + dur * 0.97);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
    osc.connect(gain); gain.connect(out);
    osc.start(t0); osc.stop(t0 + dur);
};

const RECIPES: Record<FlameSound, (bus: Bus) => void> = {
    // A low roar with a crackle on top, fading as the next tick's burst comes in
    spray: bus => {
        noise(bus, 0, SPRAY_DUR, 0.16, 0.05, 'lowpass', 900, 500);
        noise(bus, 0, SPRAY_DUR * 0.6, 0.04, 0.01, 'bandpass', 3000);
    },
    // Whoomp, then a hiss and a whistle that climb for the 3 s until the tank blows
    ignite: bus => {
        noise(bus, 0, 0.3, 0.3, 0.05, 'lowpass', 250, 1600);
        noise(bus, 0.05, FUSE_S - 0.05, 0.03, 0.18, 'highpass', 1800, 7000);
        tone(bus, FUSE_S, 0.01, 0.06, 500, 1800);
    },
};

/** Play a flamethrower sound. Nothing while muted or before audio is started. */
export const playFlameSound = (kind: FlameSound, muted: boolean): void => {
    if (muted) return;
    const bus = sfxOutput();
    if (!bus) return;
    if (kind === 'spray') {
        const now = bus.ctx.currentTime;
        if (now >= lastSpray && now - lastSpray < SPRAY_GAP) return;
        lastSpray = now;
    }
    try {
        RECIPES[kind](bus);
    } catch (e) {
        console.warn('Flame audio error', e);
    }
};

/** Play a SOUND event's subtype ('spray' or 'ignite'). A subtype this version does not know (a newer host) is ignored. */
export const playFlameSoundEvent = (subtype: string | undefined, muted: boolean): void => {
    if (subtype === 'spray' || subtype === 'ignite') playFlameSound(subtype, muted);
};
