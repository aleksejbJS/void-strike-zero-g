// Reads and writes the player's snapshot in localStorage, which stays the game's working copy.
// The game keeps using its own keys (achievements, XP, lifetime counters, build, skin, colours); this
// file only gathers them into one snapshot and spreads a snapshot back out.

import { BUILD_KEY, loadBuild, saveBuild } from '../game/build/buildStorage';
import { XP_KEY, loadXp, setXp } from '../game/build/progress';
import { sanitizeBuild } from '../game/build/sanitizeBuild';
import { BODY_PRESETS } from '../game/build/characterBases';
import { migrateCharacter, migrateRobotDefaults } from '../game/build/characterMigration';
import { clearStats, exportStats, replaceStats } from '../game/stats/lifetimeStats';
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

const hasStoredLook = (): boolean =>
    LOOK_KEYS.some(key => key !== LOOK_SAVED_AT_KEY && readStored(key) !== null);

/** The look as the game would use it now: stored parts, with the game defaults for anything missing. */
function currentLook(): FighterLook {
    const colors: FighterColors = {
        player: loadPlayerColor(), head: loadHeadColor(), torso: loadTorsoColor(),
        arms: loadArmColor(), legs: loadLegColor(), jetpack: loadJetpackColor(),
    };
    return { build: loadBuild(), skinId: loadSkin(), colors, savedAt: readSavedAt() };
}

/**
 * The build exactly as stored, so parts a newer build saved (unknown here) still reach the cloud;
 * sanitizeSnapshot keeps them well-formed. The game's own build when nothing usable is stored.
 */
function rawStoredBuild(): unknown {
    const saved = readStored(BUILD_KEY);
    if (saved === null) return loadBuild();
    try {
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
    } catch (error) {
        console.warn(`[account] stored "${BUILD_KEY}" is not valid JSON, using the game's build:`, error);
    }
    return loadBuild();
}

/** Null if the look was never customised (nothing look-related is stored). Untrusted: sanitize it. */
const readStoredLook = (): unknown => (hasStoredLook() ? { ...currentLook(), build: rawStoredBuild() } : null);

/** Writes the look keys the game reads. The "saved at" stamp is separate: see `saveLookIfChanged`. */
function writeLookKeys(look: Omit<FighterLook, 'savedAt'>): void {
    saveBuild(look.build);
    writeStored(PLAYER_KEYS.skin, look.skinId);
    for (const field of FIGHTER_COLOR_FIELDS) writeStored(PLAYER_KEYS[field], look.colors[field]);
}

function writeLook(look: FighterLook): void {
    writeLookKeys(look);
    writeStored(LOOK_SAVED_AT_KEY, String(look.savedAt));
}

export function readLocalSnapshot(): PlayerSnapshot {
    return sanitizeSnapshot({
        achievements: achievementManager.exportProgress(),
        xp: loadXp(),
        look: readStoredLook(),
        stats: exportStats(),
    });
}

/** Applies the snapshot to local storage. A snapshot without a look leaves the stored look alone. */
export function writeLocalSnapshot(snapshot: PlayerSnapshot): void {
    const clean = sanitizeSnapshot(snapshot); // replaceProgress does no shape check of its own
    achievementManager.replaceProgress(clean.achievements);
    setXp(clean.xp);
    replaceStats(clean.stats); // silent: the achievements above already carry the merged progress
    if (clean.look) {
        // A cloud look can still hold the painted robot's defaults; store it as the 3D kit's defaults
        const { colors, build } = clean.look;
        const kit = migrateRobotDefaults(colors, build.body);
        writeLook({ ...clean.look, colors: { ...kit, player: migrateRobotDefaults({ ...kit, torso: colors.player }, build.body).torso } });
    }
}

/** Forgets the whole local player: progress, XP, counters, look and name (used on logout). */
export function clearLocalSnapshot(): void {
    achievementManager.reset();
    clearStats();
    for (const key of [ACHIEVEMENT_KEY, XP_KEY, PLAYER_KEYS.name, ...LOOK_KEYS]) removeStored(key);
}

const sameLook = (a: Omit<FighterLook, 'savedAt'>, b: Omit<FighterLook, 'savedAt'>): boolean =>
    a.skinId === b.skinId
    && FIGHTER_COLOR_FIELDS.every(field => a.colors[field] === b.colors[field])
    // sanitizeBuild gives every build the same key order, so the JSON text is comparable
    && JSON.stringify(sanitizeBuild(a.build)) === JSON.stringify(sanitizeBuild(b.build));

/**
 * Saves the look; stamps it with the current time only when it differs from what the game already
 * uses. On a fresh device the "stored" look is the defaults, so an untouched default look is saved
 * without a stamp (savedAt stays 0) and can never beat a customised look from the cloud.
 */
export function saveLookIfChanged(next: Omit<FighterLook, 'savedAt'>): boolean {
    const previous = currentLook();
    if (sameLook(previous, next)) {
        if (!hasStoredLook()) writeLookKeys(next); // the match reads the saved build
        return false;
    }
    if (!previous.build.body && BODY_PRESETS.some(preset => preset.id === next.skinId)) {
        const migrated = migrateCharacter(previous.skinId, previous.build, previous.colors, {
            headIsFallback: readStored(PLAYER_KEYS.head) === null,
        });
        const equivalent = {
            build: migrated.build, skinId: BODY_PRESETS[migrated.presetIndex].id,
            colors: { ...migrated.colors, player: migrated.colors.torso },
        };
        if (sameLook(equivalent, next)) {
            // Artwork migration is not a user edit: keep its stamp so a cloud customization can win.
            writeLookKeys(next);
            return false;
        }
    }
    writeLook({ ...next, savedAt: Date.now() });
    return true;
}
