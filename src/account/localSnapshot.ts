// Reads and writes the player's snapshot in localStorage, which stays the game's working copy.
// The game keeps using its own keys (achievements, XP, build, skin, colours); this file only
// gathers them into one snapshot and spreads a snapshot back out.

import { BUILD_KEY, loadBuild, saveBuild } from '../game/build/buildStorage';
import { XP_KEY, loadXp, setXp } from '../game/build/progress';
import { sanitizeBuild } from '../game/build/sanitizeBuild';
import { achievementManager } from '../game/systems/achievements';
import {
    PLAYER_KEYS, loadArmColor, loadHeadColor, loadJetpackColor, loadLegColor, loadPlayerColor,
    loadSkin, loadTorsoColor, readStored, removeStored, writeStored,
} from '../store/playerStorage';
import { FIGHTER_COLOR_FIELDS, FighterColors, FighterLook, PlayerSnapshot, sanitizeSnapshot } from './snapshot';

export const LOOK_SAVED_AT_KEY = 'fighterLookSavedAt';
const ACHIEVEMENT_KEY = 'achievementProgress'; // owned by achievementManager, which does not export it

// Every key that holds part of the look. The player name is not one: it is the account nickname.
const LOOK_KEYS = [BUILD_KEY, LOOK_SAVED_AT_KEY, PLAYER_KEYS.skin, ...FIGHTER_COLOR_FIELDS.map(field => PLAYER_KEYS[field])];

const readSavedAt = (): number => {
    const raw = readStored(LOOK_SAVED_AT_KEY);
    if (raw === null) return 0;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return value;
    console.warn(`Ignoring invalid "${LOOK_SAVED_AT_KEY}" value "${raw}"`);
    return 0;
};

/** The look as stored now (missing parts get the game defaults); null if it was never customised. */
function readStoredLook(): FighterLook | null {
    if (!LOOK_KEYS.some(key => key !== LOOK_SAVED_AT_KEY && readStored(key) !== null)) return null;
    const colors: FighterColors = {
        player: loadPlayerColor(), head: loadHeadColor(), torso: loadTorsoColor(),
        arms: loadArmColor(), legs: loadLegColor(), jetpack: loadJetpackColor(),
    };
    return { build: loadBuild(), skinId: loadSkin(), colors, savedAt: readSavedAt() };
}

function writeLook(look: FighterLook): void {
    saveBuild(look.build);
    writeStored(PLAYER_KEYS.skin, look.skinId);
    for (const field of FIGHTER_COLOR_FIELDS) writeStored(PLAYER_KEYS[field], look.colors[field]);
    writeStored(LOOK_SAVED_AT_KEY, String(look.savedAt));
}

export function readLocalSnapshot(): PlayerSnapshot {
    return sanitizeSnapshot({
        achievements: achievementManager.exportProgress(),
        xp: loadXp(),
        look: readStoredLook(),
    });
}

/** Makes local storage match the snapshot (a snapshot without a look removes the stored look). */
export function writeLocalSnapshot(snapshot: PlayerSnapshot): void {
    const clean = sanitizeSnapshot(snapshot); // replaceProgress does no shape check of its own
    achievementManager.replaceProgress(clean.achievements);
    setXp(clean.xp);
    if (clean.look) writeLook(clean.look);
    else LOOK_KEYS.forEach(removeStored);
}

/** Forgets the whole local player: progress, XP, look and name (used on logout). */
export function clearLocalSnapshot(): void {
    achievementManager.reset();
    for (const key of [ACHIEVEMENT_KEY, XP_KEY, PLAYER_KEYS.name, ...LOOK_KEYS]) removeStored(key);
}

const sameLook = (a: Omit<FighterLook, 'savedAt'>, b: Omit<FighterLook, 'savedAt'>): boolean =>
    a.skinId === b.skinId
    && FIGHTER_COLOR_FIELDS.every(field => a.colors[field] === b.colors[field])
    // sanitizeBuild gives every build the same key order, so the JSON text is comparable
    && JSON.stringify(sanitizeBuild(a.build)) === JSON.stringify(sanitizeBuild(b.build));

/** Saves the look and stamps it with the current time, but only when it differs from the stored one. */
export function saveLookIfChanged(next: Omit<FighterLook, 'savedAt'>): boolean {
    const stored = readStoredLook();
    if (stored && sameLook(stored, next)) return false;
    writeLook({ ...next, savedAt: Date.now() });
    return true;
}
