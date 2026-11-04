import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the Web Audio nodes the synth builds: they only record what is connected and started
const node = () => ({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: '', buffer: null as unknown,
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
});
const fakeCtx = () => ({
    currentTime: 10, sampleRate: 100,
    createOscillator: vi.fn(node), createGain: vi.fn(node), createBiquadFilter: vi.fn(node), createBufferSource: vi.fn(node),
    createBuffer: (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
});
let ctx = fakeCtx();
let available = true;
vi.mock('./audio', () => ({ sfxOutput: () => (available ? { ctx, out: { connect: vi.fn() } } : null) }));

const { playCoverSound, playCoverSoundEvent } = await import('./coverAudio');

const sounds = () => ctx.createOscillator.mock.calls.length + ctx.createBufferSource.mock.calls.length;

// Every test starts a long while after the last one: the throttle remembers when each sound last played
let clock = 0;
beforeEach(() => { ctx = fakeCtx(); available = true; ctx.currentTime = clock += 100; });

describe('playCoverSound', () => {
    it.each(['wood', 'metal', 'glass', 'barrel'] as const)('%s makes a sound for a hit and a break', kind => {
        playCoverSound(kind, 'hit', false);
        const afterHit = sounds();
        expect(afterHit).toBeGreaterThan(0);
        playCoverSound(kind, 'break', false);
        expect(sounds()).toBeGreaterThan(afterHit);
    });

    it('stays silent while muted', () => {
        playCoverSound('wood', 'break', true);
        expect(sounds()).toBe(0);
    });

    it('stays silent before audio has been started', () => {
        available = false;
        expect(() => playCoverSound('wood', 'break', false)).not.toThrow();
        expect(sounds()).toBe(0);
    });

    it('plays one sound for six pellets landing together', () => {
        for (let i = 0; i < 6; i++) playCoverSound('metal', 'hit', false);
        const once = sounds();
        ctx.currentTime += 1;
        playCoverSound('metal', 'hit', false);
        expect(sounds()).toBe(once * 2);
    });
});

describe('playCoverSoundEvent', () => {
    it('plays the kind and action named by the SOUND subtype', () => {
        playCoverSoundEvent('glass:break', false);
        expect(sounds()).toBeGreaterThan(5); // the glass shatter has a burst and a spray of tinkles
    });

    it.each([undefined, '', 'wood', 'wood:restore', 'plasma:hit', 'toString:hit', '__proto__:break'])('ignores the subtype %s', subtype => {
        playCoverSoundEvent(subtype, false);
        expect(sounds()).toBe(0);
    });
});
