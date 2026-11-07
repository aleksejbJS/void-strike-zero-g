// Sounds of cover being hit and broken, synthesised with Web Audio like audio.ts: a wood crack, a metal
// clang, a glass shatter and a hollow barrel with a hiss of leaking fuel. The simulation announces them as
// SOUND events {sound: 'cover', subtype: '<kind>:<hit|break>'}; playCoverSoundEvent plays one for a client.

import { COVER_SPECS, CoverKind } from '../cover/coverTypes';
import { sfxOutput } from './audio';

export type CoverSoundAction = 'hit' | 'break';
type Bus = NonNullable<ReturnType<typeof sfxOutput>>;
type Recipe = (bus: Bus) => void;

/** Seconds between two identical sounds: one shotgun blast lands six pellets on a piece at once. */
const MIN_GAP = 0.04;
const FLOOR = 0.001; // an exponential ramp cannot reach 0

const lastPlayed = new Map<string, number>();
let noiseBuffer: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

/** One second of white noise for `ctx`, made once and shared (flameAudio.ts plays it too). */
export const whiteNoise = (ctx: AudioContext): AudioBuffer => {
    if (noiseBuffer?.ctx === ctx) return noiseBuffer.buffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = { ctx, buffer };
    return buffer;
};

/** Fade `gain` from `vol` to silence over `dur` seconds from `t0`. */
const fade = (gain: GainNode, t0: number, dur: number, vol: number) => {
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
};

/** A ringing tone `at` seconds from now, sliding from `freq` to `freqEnd`. */
const tone = (bus: Bus, at: number, dur: number, vol: number, type: OscillatorType, freq: number, freqEnd = freq) => {
    const { ctx, out } = bus, t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    fade(gain, t0, dur, vol);
    osc.connect(gain); gain.connect(out);
    osc.start(t0); osc.stop(t0 + dur);
};

/** A burst of filtered noise `at` seconds from now: a snap, a rattle or a hiss depending on the filter. */
const burst = (bus: Bus, at: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, freqEnd = freq) => {
    const { ctx, out } = bus, t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = whiteNoise(ctx);
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    fade(gain, t0, dur, vol);
    src.connect(filter); filter.connect(gain); gain.connect(out);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur);
};

const RECIPES: Record<CoverKind, Record<CoverSoundAction, Recipe>> = {
    wood: {
        hit: bus => { burst(bus, 0, 0.08, 0.22, 'bandpass', 900); tone(bus, 0, 0.1, 0.12, 'triangle', 190, 90); },
        break: bus => {
            burst(bus, 0, 0.2, 0.3, 'bandpass', 1400, 400);
            burst(bus, 0.05, 0.12, 0.22, 'highpass', 2500);
            burst(bus, 0.12, 0.15, 0.2, 'bandpass', 700);
            tone(bus, 0, 0.3, 0.2, 'sawtooth', 120, 55);
        },
    },
    metal: {
        hit: bus => { tone(bus, 0, 0.3, 0.1, 'square', 1250); tone(bus, 0, 0.25, 0.07, 'sine', 1870); burst(bus, 0, 0.03, 0.2, 'highpass', 4000); },
        break: bus => {
            tone(bus, 0, 0.7, 0.14, 'square', 420); tone(bus, 0, 0.6, 0.1, 'sine', 690); tone(bus, 0, 0.5, 0.08, 'sine', 1130);
            burst(bus, 0, 0.4, 0.28, 'bandpass', 2500);
            tone(bus, 0, 0.35, 0.22, 'sawtooth', 110, 50);
        },
    },
    glass: {
        hit: bus => { tone(bus, 0, 0.12, 0.09, 'sine', 3300); tone(bus, 0, 0.1, 0.05, 'sine', 4900); },
        break: bus => {
            burst(bus, 0, 0.5, 0.3, 'highpass', 3000);
            for (let i = 0; i < 9; i++) tone(bus, 0.03 + Math.random() * 0.45, 0.08, 0.04 + Math.random() * 0.05, 'sine', 2500 + Math.random() * 3500);
        },
    },
    barrel: {
        // The leak hisses on every hit; a badly damaged barrel is hit often, so it hisses most
        hit: bus => { tone(bus, 0, 0.22, 0.13, 'triangle', 260, 200); tone(bus, 0, 0.15, 0.07, 'sine', 520); burst(bus, 0.02, 0.35, 0.09, 'highpass', 3500); },
        break: bus => { tone(bus, 0, 0.25, 0.2, 'sawtooth', 180, 60); burst(bus, 0, 0.3, 0.22, 'bandpass', 900); },
    },
};

/** Play the sound of a piece of cover being hit or broken. Nothing while muted or before audio is started. */
export const playCoverSound = (kind: CoverKind, action: CoverSoundAction, muted: boolean): void => {
    if (muted) return;
    const bus = sfxOutput();
    if (!bus) return;
    const key = `${kind}:${action}`, now = bus.ctx.currentTime;
    if (now - (lastPlayed.get(key) ?? -MIN_GAP) < MIN_GAP) return;
    lastPlayed.set(key, now);
    try {
        RECIPES[kind][action](bus);
    } catch (e) {
        console.warn('Cover audio error', e);
    }
};

/** Play a SOUND event's subtype ('wood:hit'). A subtype this version does not know (a newer host) is ignored. */
export const playCoverSoundEvent = (subtype: string | undefined, muted: boolean): void => {
    const [kind, action] = (subtype ?? '').split(':');
    if (!Object.hasOwn(COVER_SPECS, kind) || (action !== 'hit' && action !== 'break')) return;
    playCoverSound(kind as CoverKind, action, muted);
};
