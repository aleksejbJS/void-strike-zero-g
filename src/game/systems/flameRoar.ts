// The flamethrower's roar (after the owner's demo): one looping low rumble and high hiss per audio context,
// raised by every flame tick and dropping 150 ms after the last one, so a held trigger is one steady roar.
// Plus short noise bursts: the whoomp of a stream starting and the crackle of fire.

import type { sfxOutput } from './audio';

type Bus = NonNullable<ReturnType<typeof sfxOutput>>;

const ROAR_VOL = 0.28;
const HISS_VOL = 0.055;
/** A tick keeps the roar up this long (s); ticks come every 100 ms per stream. */
const HOLD = 0.15;
/** Ticks within this window (s) count as streams spraying at once: a few more make it a bit louder. */
const WINDOW = 0.15;
/** More silence than this (s) before a tick means a stream just started. */
const START_GAP = 0.3;
const FLOOR = 0.001; // an exponential ramp cannot reach 0

interface Roar { ctx: AudioContext; rumble: GainNode; hiss: GainNode; band: BiquadFilterNode; recent: number[]; last: number }

let roar: Roar | null = null;
let brown: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

/** Two seconds of brown noise (a deep rumble, unlike white noise's hiss) for `ctx`, made once. */
export const brownNoise = (ctx: AudioContext): AudioBuffer => {
    if (brown?.ctx === ctx) return brown.buffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
    }
    brown = { ctx, buffer };
    return buffer;
};

const loop = (bus: Bus, rate: number): AudioBufferSourceNode => {
    const src = bus.ctx.createBufferSource();
    src.buffer = brownNoise(bus.ctx);
    src.loop = true;
    src.playbackRate.value = rate;
    src.start();
    return src;
};

/** Build the two endless loops, silent until a tick raises them. */
const build = (bus: Bus): Roar => {
    const { ctx, out } = bus;
    const band = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), rumble = ctx.createGain();
    band.type = 'bandpass'; band.frequency.value = 400; band.Q.value = 0.7;
    low.type = 'lowpass'; low.frequency.value = 1100;
    rumble.gain.value = 0;
    loop(bus, 1).connect(band); band.connect(low); low.connect(rumble); rumble.connect(out);
    const high = ctx.createBiquadFilter(), hiss = ctx.createGain();
    high.type = 'highpass'; high.frequency.value = 2800;
    hiss.gain.value = 0;
    loop(bus, 1.7).connect(high); high.connect(hiss); hiss.connect(out);
    return { ctx, rumble, hiss, band, recent: [], last: -Infinity };
};

/** Glide `param` to `value` now and back to silence HOLD later, dropping the silence planned by the last tick. */
const hold = (param: AudioParam, value: number, now: number) => {
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, 0.05);
    param.setTargetAtTime(0, now + HOLD, 0.08);
};

/** One flame tick heard: keeps the roar going. True when it starts a stream (silence before it). */
export const roarTick = (bus: Bus): boolean => {
    if (roar?.ctx !== bus.ctx) roar = build(bus);
    const r = roar, now = bus.ctx.currentTime;
    const started = now - r.last > START_GAP || now < r.last;
    r.last = now;
    r.recent = r.recent.filter(t => t <= now && now - t < WINDOW);
    r.recent.push(now);
    const level = Math.min(1, 0.75 + 0.12 * (r.recent.length - 1));
    hold(r.rumble.gain, ROAR_VOL * level, now);
    hold(r.hiss.gain, HISS_VOL * level, now);
    r.band.frequency.setTargetAtTime(280 + 520 * level + (Math.random() - 0.5) * 180, now, 0.05);
    return started;
};

/** A short filtered burst of the rumble buffer. */
const burst = (bus: Bus, dur: number, type: BiquadFilterType, freq: number, vol: number, rate: number) => {
    const { ctx, out } = bus, t = ctx.currentTime;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = brownNoise(ctx);
    src.playbackRate.value = rate;
    filter.type = type; filter.frequency.value = freq; filter.Q.value = 1.4;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(out);
    src.start(t, Math.random() * 1.1, dur + 0.05);
};

/** The soft whoomp of a stream catching. */
export const whoomp = (bus: Bus): void => burst(bus, 0.28, 'lowpass', 1600, 0.2, 0.9);

/** One crackle of fire at volume `vol`. */
export const crackle = (bus: Bus, vol: number): void =>
    burst(bus, 0.05 + Math.random() * 0.05, 'bandpass', 1200 + Math.random() * 2600, vol, 0.7 + Math.random() * 0.8);
