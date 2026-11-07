import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the Web Audio nodes the synth builds: they only record what is connected and started
const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
const node = () => ({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: '', loop: false, buffer: null as unknown,
    gain: param(), frequency: param(),
});
const fakeCtx = () => ({
    currentTime: 10, sampleRate: 100,
    createOscillator: vi.fn(node), createGain: vi.fn(node), createBiquadFilter: vi.fn(node), createBufferSource: vi.fn(node),
    createBuffer: (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
});
let ctx = fakeCtx();
let available = true;
vi.mock('./audio', () => ({ sfxOutput: () => (available ? { ctx, out: { connect: vi.fn() } } : null) }));

const { playFlameSound, playFlameSoundEvent } = await import('./flameAudio');

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

    it('several fighters spraying in the same instant make one roar, the next tick another', () => {
        for (let i = 0; i < 4; i++) playFlameSound('spray', false);
        const once = sounds();
        ctx.currentTime += 0.1;
        playFlameSound('spray', false);
        expect(sounds()).toBe(once * 2);
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
