// Sounds of the flamethrower, synthesised with Web Audio like coverAudio.ts. The simulation announces them
// as SOUND events {sound: 'flame', subtype: 'spray' | 'ignite'}: a spray comes with every flame tick
// (10 per second) and keeps one steady roar going (flameRoar.ts), with a whoomp when a stream starts and
// crackle on top; an ignite is a fuel tank catching fire, a whoomp and then a hiss that rises for the
// whole fuse, right up to the blast. Fire burning in place crackles too (playFlameCrackle).

import { sfxOutput } from './audio';
import { whiteNoise } from './coverAudio';
import { TANK_FUSE_MS } from './flameConstants';
import { crackle, roarTick, whoomp } from './flameRoar';

export type FlameSound = 'spray' | 'ignite';
type Bus = NonNullable<ReturnType<typeof sfxOutput>>;

/** Least time (s) between two crackles, however many fires burn. */
const CRACKLE_GAP = 0.06;
/** Chance a flame tick crackles. */
const SPRAY_CRACKLE = 0.6;
const FUSE_S = TANK_FUSE_MS / 1000;
const FLOOR = 0.001; // an exponential ramp cannot reach 0

let lastCrackle = -Infinity;

/** A crackle at volume `vol`, unless one came less than CRACKLE_GAP ago. */
const crackleOnce = (bus: Bus, vol: number) => {
    const now = bus.ctx.currentTime;
    if (now >= lastCrackle && now - lastCrackle < CRACKLE_GAP) return;
    lastCrackle = now;
    crackle(bus, vol);
};

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
    // Keep the roar going: a whoomp when the stream just started, and now and then a crackle
    spray: bus => {
        if (roarTick(bus)) whoomp(bus);
        if (Math.random() < SPRAY_CRACKLE) crackleOnce(bus, 0.025 + Math.random() * 0.05);
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

/**
 * Crackle of `burning` fires burning in place (splash fire, burning fighters) over a frame of `dtMs`;
 * called every frame by the game screen.
 */
export const playFlameCrackle = (burning: number, dtMs: number, muted: boolean): void => {
    if (muted || burning <= 0) return;
    if (Math.random() >= (dtMs / 1000) * Math.min(7, burning * 1.8)) return;
    const bus = sfxOutput();
    if (!bus) return;
    try {
        crackleOnce(bus, 0.02 + Math.random() * 0.035);
    } catch (e) {
        console.warn('Flame audio error', e);
    }
};
