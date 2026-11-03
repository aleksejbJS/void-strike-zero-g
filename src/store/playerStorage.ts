// Player name, skin and colours kept in localStorage. Storage may be missing (server) or throw
// (private mode), so every access is guarded: reads fall back to the defaults with a warning.

import { GUEST_DEFAULT_NAME } from '../account/nickname';

export const PLAYER_KEYS = {
  name: 'playerName',
  skin: 'selectedSkin',
  player: 'playerColor',
  torso: 'torsoColor',
  head: 'headColor',
  arms: 'armColor',
  legs: 'legColor',
  jetpack: 'jetpackColor',
} as const;

const DEFAULT_SKIN = 'classic';
const DEFAULT_PLAYER_COLOR = '#3b82f6';
const DEFAULT_LEG_COLOR = '#475569';
const DEFAULT_JETPACK_COLOR = '#ef4444';

/** Raw stored string, or null when nothing (or an empty string) is stored or storage is unavailable. */
export function readStored(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    return localStorage.getItem(key) || null;
  } catch (err) {
    console.warn(`Could not read "${key}" from storage, using the default:`, err);
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Could not save "${key}" to storage:`, err);
  }
}

export function removeStored(key: string): void {
  try {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Could not remove "${key}" from storage:`, err);
  }
}

export const loadPlayerName = (): string => readStored(PLAYER_KEYS.name) ?? GUEST_DEFAULT_NAME;
export const loadSkin = (): string => readStored(PLAYER_KEYS.skin) ?? DEFAULT_SKIN;
export const loadPlayerColor = (): string => readStored(PLAYER_KEYS.player) ?? DEFAULT_PLAYER_COLOR;
// Head, torso and arms fall back to the player colour; legs and jetpack have their own defaults.
export const loadHeadColor = (): string => readStored(PLAYER_KEYS.head) ?? loadPlayerColor();
export const loadTorsoColor = (): string => readStored(PLAYER_KEYS.torso) ?? loadPlayerColor();
export const loadArmColor = (): string => readStored(PLAYER_KEYS.arms) ?? loadPlayerColor();
export const loadLegColor = (): string => readStored(PLAYER_KEYS.legs) ?? DEFAULT_LEG_COLOR;
export const loadJetpackColor = (): string => readStored(PLAYER_KEYS.jetpack) ?? DEFAULT_JETPACK_COLOR;

export interface StoredPlayer {
  playerName: string;
  selectedSkin: string;
  playerColor: string;
  headColor: string;
  torsoColor: string;
  armColor: string;
  legColor: string;
  jetpackColor: string;
}

/** Name, skin and all colours as they are stored right now (initial UI state and `reloadPlayer`). */
export const loadStoredPlayer = (): StoredPlayer => ({
  playerName: loadPlayerName(),
  selectedSkin: loadSkin(),
  playerColor: loadPlayerColor(),
  headColor: loadHeadColor(),
  torsoColor: loadTorsoColor(),
  armColor: loadArmColor(),
  legColor: loadLegColor(),
  jetpackColor: loadJetpackColor(),
});
