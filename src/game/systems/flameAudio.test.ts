import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the Web Audio nodes the synth builds: they only record what is connected and started
const param = () => ({
    value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
});
const node = () => ({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: '', loop: false, buffer: null as unknown,
    gain: param(), frequency: param(), Q: param(), playbackRate: param(),
});
const fakeCtx = () => ({
    currentTime: 10, sampleRate: 100,
    createOscillator: vi.fn(node), createGain: vi.fn(node), createBiquadFilter: vi.fn(node), createBufferSource: vi.fn(node),
    createBuffer: (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
});
let ctx = fakeCtx();
let available = true;
vi.mock('./audio', () => ({ sfxOutput: () => (available ? { ctx, out: { connect: vi.fn() } } : null) }));

const { playFlameCrackle, playFlameSound, playFlameSoundEvent } = await import('./flameAudio');

const sounds = () => ctx.createOscillator.mock.calls.length + ctx.createBufferSource.mock.calls.length;

// Every test starts a long while after the last one: the spray throttle remembers when it last played
let clock = 0;
beforeEach(() => { ctx = fakeCtx(); available = true; ctx.currentTime = clock += 100; });

describe('playFlameSound', () => {
    it.each(['spray', 'ignite'] as const)('%s makes a sound', kind => {
        playFlameSound(kind, false);
        expect(sounds()).toBeGreaterThan(0);
    });

    it('the ignite hiss lasts the whole fuse', () => {
        playFlameSound('ignite', false);
        const stops = ctx.createBufferSource.mock.results.map(r => r.value.stop.mock.calls[0][0] - ctx.currentTime);
        expect(Math.max(...stops)).toBeCloseTo(3, 1);
    });

    it('stays silent while muted or before audio has been started', () => {
        playFlameSound('ignite', true);
        available = false;
        expect(() => playFlameSound('spray', false)).not.toThrow();
        expect(sounds()).toBe(0);
    });

    it('sprays keep one roar going: its loops are built once, every tick only raises them again', () => {
        playFlameSound('spray', false);
        const loops = ctx.createBufferSource.mock.results.filter(r => r.value.loop).length;
        expect(loops).toBe(2); // the rumble and the hiss
        const rumble = ctx.createGain.mock.results[0].value.gain;
        ctx.currentTime += 0.1;
        playFlameSound('spray', false);
        expect(ctx.createBufferSource.mock.results.filter(r => r.value.loop)).toHaveLength(2);
        // each tick cancels the planned silence and plans a new one 150 ms later
        expect(rumble.cancelScheduledValues).toHaveBeenCalledTimes(2);
        const silences = rumble.setTargetAtTime.mock.calls.filter((c: number[]) => c[0] === 0);
        expect(silences.at(-1)?.[1]).toBeCloseTo(ctx.currentTime + 0.15, 5);
    });

    it('a stream starting with a whoomp, its next ticks without one', () => {
        playFlameSound('spray', false);
        const lowpassBursts = () => ctx.createBiquadFilter.mock.results.filter(r => r.value.type === 'lowpass').length;
        const first = lowpassBursts(); // the roar's own lowpass + the whoomp
        ctx.currentTime += 0.1;
        playFlameSound('spray', false);
        expect(lowpassBursts()).toBe(first);
        expect(first).toBeGreaterThanOrEqual(2);
    });
});

describe('playFlameCrackle', () => {
    it('crackles while fires burn and stays silent when muted or with none', () => {
        const before = sounds();
        playFlameCrackle(0, 1000, false);
        playFlameCrackle(5, 1000, true);
        expect(sounds()).toBe(before);
        playFlameCrackle(5, 1000, false); // a whole second with five fires: certain to crackle
        expect(sounds()).toBeGreaterThan(before);
    });
});

describe('playFlameSoundEvent', () => {
    it('plays the subtype of a SOUND event', () => {
        playFlameSoundEvent('ignite', false);
        expect(sounds()).toBeGreaterThan(0);
    });

    it.each([undefined, '', 'roar', 'toString', '__proto__'])('ignores the subtype %s', subtype => {
        playFlameSoundEvent(subtype, false);
        expect(sounds()).toBe(0);
    });
});
