import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Minimal Web Audio stand-in: counts contexts and resume() calls, starts suspended like a page without a gesture
class FakeContext {
    static created = 0;
    static resumes = 0;
    state: 'suspended' | 'running' = 'suspended';
    sampleRate = 8000;
    currentTime = 0;
    destination = {};
    constructor() { FakeContext.created++; }
    async resume() { FakeContext.resumes++; this.state = 'running'; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    createBuffer(_channels: number, length: number) { return { length, copyToChannel() {} }; }
    createOscillator() { return { frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, type: 'sine', connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 }, type: 'lowpass', connect() {} }; }
}

const load = async () => {
    vi.resetModules();
    return import('./audio');
};

describe('audio warm-up', () => {
    beforeEach(() => {
        FakeContext.created = 0;
        FakeContext.resumes = 0;
        vi.stubGlobal('AudioContext', FakeContext);
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('prepareAudio builds the context ahead of time without resuming it', async () => {
        const audio = await load();
        await audio.prepareAudio();
        expect(FakeContext.created).toBe(1);
        expect(FakeContext.resumes).toBe(0);
    });

    it('initAudio after prepareAudio only resumes the existing context', async () => {
        const audio = await load();
        await audio.prepareAudio();
        await audio.initAudio();
        expect(FakeContext.created).toBe(1);
        expect(FakeContext.resumes).toBe(1);
    });

    it('stays silent while the context is still suspended', async () => {
        const audio = await load();
        await audio.prepareAudio();
        // Sounds scheduled on a frozen clock would all burst out at once on resume
        expect(audio.sfxOutput()).toBeNull();
        await audio.initAudio();
        expect(audio.sfxOutput()).not.toBeNull();
    });
});
