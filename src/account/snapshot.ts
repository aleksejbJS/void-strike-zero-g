// The player's whole saved progress as one value: what is pulled from / pushed to the cloud.
// Pure data, no storage access. Sanitizing makes any untrusted value valid; merging never lowers anything.

import { DEFAULT_BUILD, FighterBuild } from '../game/build/buildParts';
import { sanitizeBuild } from '../game/build/sanitizeBuild';
import { ACHIEVEMENTS } from '../game/systems/achievements';
import type { AchievementProgress } from '../game/systems/achievements';

export interface FighterColors { player: string; head: string; torso: string; arms: string; legs: string; jetpack: string }
export interface FighterLook { build: FighterBuild; skinId: string; colors: FighterColors; savedAt: number }
/** `look: null` means the guest never customised the fighter. */
export interface PlayerSnapshot { achievements: AchievementProgress; xp: number; look: FighterLook | null }

type Entry = AchievementProgress[string];

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const FIGHTER_COLOR_FIELDS: readonly (keyof FighterColors)[] = ['player', 'head', 'torso', 'arms', 'legs', 'jetpack'];
const MAX_SKIN_ID = 40;
const KNOWN_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map(a => a.id));

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function sanitizeEntry(raw: unknown): Entry | null {
    if (!isRecord(raw) || !isCount(raw.progress) || typeof raw.unlocked !== 'boolean') return null;
    const entry: Entry = { progress: raw.progress, unlocked: raw.unlocked };
    if (isCount(raw.unlockedAt)) entry.unlockedAt = raw.unlockedAt;
    return entry;
}

function sanitizeAchievements(raw: unknown): AchievementProgress {
    const result: AchievementProgress = {};
    if (!isRecord(raw)) return result;
    for (const id of Object.keys(raw)) {
        if (!KNOWN_IDS.has(id)) continue;
        const entry = sanitizeEntry(raw[id]);
        if (entry) result[id] = entry;
    }
    return result;
}

function sanitizeColors(raw: unknown): FighterColors | null {
    if (!isRecord(raw)) return null;
    const colors = {} as FighterColors;
    for (const field of FIGHTER_COLOR_FIELDS) {
        const value = raw[field];
        if (typeof value !== 'string' || !COLOR_RE.test(value)) return null;
        colors[field] = value;
    }
    return colors;
}

function sanitizeLook(raw: unknown): FighterLook | null {
    if (!isRecord(raw) || !isRecord(raw.build) || !isCount(raw.savedAt)) return null;
    const { skinId } = raw;
    if (typeof skinId !== 'string' || skinId.length === 0 || skinId.length > MAX_SKIN_ID) return null;
    const colors = sanitizeColors(raw.colors);
    if (!colors) return null;
    return { build: sanitizeBuild(raw.build, DEFAULT_BUILD), skinId, colors, savedAt: raw.savedAt };
}

/** Makes any untrusted value (cloud row, saved JSON) into a valid snapshot; bad parts are dropped. */
export function sanitizeSnapshot(raw: unknown): PlayerSnapshot {
    const source = isRecord(raw) ? raw : {};
    return {
        achievements: sanitizeAchievements(source.achievements),
        xp: isCount(source.xp) ? Math.floor(source.xp) : 0,
        look: sanitizeLook(source.look),
    };
}

const earliest = (a?: number, b?: number): number | undefined =>
    a === undefined ? b : b === undefined ? a : Math.min(a, b);

function mergeEntry(a: Entry | undefined, b: Entry | undefined): Entry {
    if (!a || !b) return { ...(a ?? b!) };
    const merged: Entry = { progress: Math.max(a.progress, b.progress), unlocked: a.unlocked || b.unlocked };
    const unlockedAt = earliest(a.unlockedAt, b.unlockedAt);
    if (unlockedAt !== undefined) merged.unlockedAt = unlockedAt;
    return merged;
}

const copyLook = (look: FighterLook): FighterLook => ({ ...look, build: { ...look.build }, colors: { ...look.colors } });

function mergeLooks(a: FighterLook | null, b: FighterLook | null): FighterLook | null {
    const winner = !a ? b : !b ? a : b.savedAt > a.savedAt ? b : a; // a tie keeps `a`
    return winner ? copyLook(winner) : null;
}

/** Never lowers anything: max progress and XP, unlocked if either side unlocked, newest look wins. */
export function mergeSnapshots(a: PlayerSnapshot, b: PlayerSnapshot): PlayerSnapshot {
    const achievements: AchievementProgress = {};
    for (const id of new Set([...Object.keys(a.achievements), ...Object.keys(b.achievements)])) {
        achievements[id] = mergeEntry(a.achievements[id], b.achievements[id]);
    }
    return { achievements, xp: Math.max(a.xp, b.xp), look: mergeLooks(a.look, b.look) };
}
