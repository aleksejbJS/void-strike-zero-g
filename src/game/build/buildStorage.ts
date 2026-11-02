// Saved fighter build in localStorage. Storage may be missing (server) or throw (private mode),
// so every access is guarded and failures fall back to defaults with a warning.

import { DEFAULT_BUILD, FighterBuild } from './buildParts';
import { presetBuild } from './buildPresets';
import { sanitizeBuild } from './sanitizeBuild';

export const BUILD_KEY = 'fighterBuild';
const SKIN_KEY = 'selectedSkin'; // written by the character setup; migrated into a build on first load
const DEFAULT_SKIN = 'classic';

const storage = (): Storage => {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    return localStorage;
};

export function loadBuild(): FighterBuild {
    try {
        const store = storage();
        const saved = store.getItem(BUILD_KEY);
        if (typeof saved !== 'string') return presetBuild(store.getItem(SKIN_KEY) ?? DEFAULT_SKIN);
        return sanitizeBuild(JSON.parse(saved), DEFAULT_BUILD);
    } catch (err) {
        console.warn(`Could not read "${BUILD_KEY}" from storage, using the default build:`, err);
        return { ...DEFAULT_BUILD };
    }
}

export function saveBuild(build: FighterBuild): void {
    try {
        storage().setItem(BUILD_KEY, JSON.stringify(build));
    } catch (err) {
        console.warn(`Could not save "${BUILD_KEY}" to storage:`, err);
    }
}
