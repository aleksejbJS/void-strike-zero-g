
import { WeaponType, GameMode } from '../../types';

let audioCtx: AudioContext | null = null;
let backgroundMusic: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentBackgroundMusic: string | null = null;
const audioBuffers = new Map<string, AudioBuffer>();
let proceduralAudioPromise: Promise<void> | null = null;

// Background music tracks
const MUSIC_TRACKS = {
  menu: 'menu_theme',
  game: 'game_theme',
  intense: 'intense_theme',
  victory: 'victory_theme'
};

/**
 * Build the context, gains and procedural buffers ahead of time (at match load). Needs no user
 * gesture: the context may start suspended. Creating it is the slow part (~250 ms on macOS),
 * so doing it here keeps that stall off the first shot.
 */
export const prepareAudio = async () => {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not supported in this browser');
    audioCtx = new Ctor();
  }

  if (!sfxGain) {
    sfxGain = audioCtx.createGain();
    sfxGain.connect(audioCtx.destination);
    sfxGain.gain.value = 0.7;
  }

  if (!musicGain) {
    musicGain = audioCtx.createGain();
    musicGain.connect(audioCtx.destination);
    musicGain.gain.value = 0.3;
  }

  // Generate procedural audio buffers once
  if (!proceduralAudioPromise) proceduralAudioPromise = generateProceduralAudio();
  await proceduralAudioPromise;
};

/** Wake the audio up; call from a user gesture (click or key), as browsers require. Cheap after prepareAudio. */
export const initAudio = async () => {
  await prepareAudio();
  if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
};

/** A context that is not running yet would queue sounds on a frozen clock and play them all at once later. */
const running = () => audioCtx !== null && audioCtx.state === 'running';

const generateProceduralAudio = async () => {
  if (!audioCtx) return;

  // Generate basic sound effects procedurally
  const sampleRate = audioCtx.sampleRate;
  const duration = 1; // 1 second
  const frameCount = sampleRate * duration;

  // Menu music - simple melody
  const menuMusic = generateMenuMusic(frameCount, sampleRate);
  audioBuffers.set('menu_theme', await createAudioBuffer(menuMusic));

  // Game music - more intense
  const gameMusic = generateGameMusic(frameCount, sampleRate);
  audioBuffers.set('game_theme', await createAudioBuffer(gameMusic));

  // Intense music for combat
  const intenseMusic = generateIntenseMusic(frameCount, sampleRate);
  audioBuffers.set('intense_theme', await createAudioBuffer(intenseMusic));

  // Victory music
  const victoryMusic = generateVictoryMusic(frameCount * 0.5, sampleRate);
  audioBuffers.set('victory_theme', await createAudioBuffer(victoryMusic));
};

const createAudioBuffer = async (audioData: Float32Array): Promise<AudioBuffer> => {
  if (!audioCtx) throw new Error('Audio context not initialized');
  const buffer = audioCtx.createBuffer(1, audioData.length, audioCtx.sampleRate);
  buffer.copyToChannel(audioData as Float32Array<ArrayBuffer>, 0);
  return buffer;
};

const generateMenuMusic = (frameCount: number, sampleRate: number): Float32Array => {
  const audioData = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    // Simple melody with sine waves
    const freq1 = 220 + Math.sin(t * 2) * 50; // A3 with variation
    const freq2 = 330 + Math.sin(t * 3) * 30; // E4 with variation
    audioData[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.3 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.2) * Math.exp(-t * 0.5);
  }
  return audioData;
};

const generateGameMusic = (frameCount: number, sampleRate: number): Float32Array => {
  const audioData = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const freq1 = 293.66 + Math.sin(t * 4) * 100; // D4 with more variation
    const freq2 = 369.99 + Math.sin(t * 5) * 80;  // F#4
    audioData[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.4 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.3) * Math.exp(-t * 0.3);
  }
  return audioData;
};

const generateIntenseMusic = (frameCount: number, sampleRate: number): Float32Array => {
  const audioData = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const freq1 = 440 + Math.sin(t * 8) * 200; // A4 with fast variation
    const freq2 = 554.37 + Math.sin(t * 6) * 150; // C#5
    audioData[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.4 +
      Math.sin(2 * Math.PI * 880 * t) * 0.1) * Math.exp(-t * 0.2);
  }
  return audioData;
};

const generateVictoryMusic = (frameCount: number, sampleRate: number): Float32Array => {
  const audioData = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const freq1 = 523.25; // C5
    const freq2 = 659.25; // E5
    const freq3 = 783.99; // G5
    audioData[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.4 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
      Math.sin(2 * Math.PI * freq3 * t) * 0.2) * Math.exp(-t * 0.8);
  }
  return audioData;
};

export const playBackgroundMusic = (track: keyof typeof MUSIC_TRACKS, isMuted: boolean = false) => {
  if (isMuted || !audioCtx || !musicGain) return;

  // Stop current music
  if (backgroundMusic) {
    backgroundMusic.stop();
    backgroundMusic = null;
  }

  const buffer = audioBuffers.get(MUSIC_TRACKS[track]);
  if (!buffer) return;

  backgroundMusic = audioCtx.createBufferSource();
  backgroundMusic.buffer = buffer;
  backgroundMusic.connect(musicGain);
  backgroundMusic.loop = true;
  backgroundMusic.start();

  currentBackgroundMusic = MUSIC_TRACKS[track];
};

export const stopBackgroundMusic = () => {
  if (backgroundMusic) {
    backgroundMusic.stop();
    backgroundMusic = null;
    currentBackgroundMusic = null;
  }
};

export const setMusicVolume = (volume: number) => {
  if (musicGain) {
    musicGain.gain.value = Math.max(0, Math.min(1, volume));
  }
};

export const setSFXVolume = (volume: number) => {
  if (sfxGain) {
    sfxGain.gain.value = Math.max(0, Math.min(1, volume));
  }
};

/** The sound-effects output for synths in other files (none until the audio runs after a click or key). */
export const sfxOutput = (): { ctx: AudioContext; out: GainNode } | null =>
  audioCtx && sfxGain && running() ? { ctx: audioCtx, out: sfxGain } : null;

export const playSound = (type: 'shoot' | 'hit' | 'explosion' | 'jump' | 'pickup' | 'shell' | 'score' | 'dash' | 'hook' | 'reload' | 'kill' | 'respawn', weaponType?: WeaponType, isMuted: boolean = false) => {
  if (isMuted || !audioCtx || !sfxGain || !running()) return;

  try {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    const now = ctx.currentTime;

    if (type === 'shoot') {
      osc.type = 'square';
      if (weaponType === WeaponType.ROCKET_LAUNCHER) {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (weaponType === WeaponType.RAILGUN) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      } else {
        osc.frequency.setValueAtTime(200 + Math.random() * 100, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
      }
    } else if (type === 'explosion') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'pickup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'score') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'shell') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'dash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'hook') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(300, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'reload') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(250, now + 0.1);
      osc.frequency.setValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 0.1);
      gain.gain.setValueAtTime(0.08, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'kill') {
      // Multi-oscillator kill sound
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(sfxGain);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(600, now);
      osc2.frequency.exponentialRampToValueAtTime(300, now + 0.3);
      gain2.gain.setValueAtTime(0.1, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.start(now); osc.stop(now + 0.3);
      osc2.start(now); osc2.stop(now + 0.3);
    } else if (type === 'respawn') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    }
  } catch (e) {
    console.warn("Audio error", e);
  }
};
