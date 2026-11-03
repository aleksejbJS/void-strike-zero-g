// The player's whole saved progress as one value: what is pulled from / pushed to the cloud.
// Pure data, no storage access. Sanitizing makes any untrusted value valid; merging never lowers anything.
// Forward compatible: data a newer build added (achievement ids, fighter parts or slots this build does
// not know) is kept, well-formed and bounded, so an older tab never erases it from the cloud. The game
// ignores it: achievements are read through their definitions, and the build is sanitized on every load.

import { DEFAULT_BUILD, FighterBuild } from '../game/build/buildParts';
import { sanitizeBuild } from '../game/build/sanitizeBuild';
import type { AchievementProgress } from '../game/systems/achievements';

export interface FighterColors { player: string; head: string; torso: string; arms: string; legs: string; jetpack: string }
export interface FighterLook { build: FighterBuild; skinId: string; colors: FighterColors; savedAt: number }
/** `look: null` means the guest never customised the fighter. */
export interface PlayerSnapshot { achievements: AchievementProgress; xp: number; look: FighterLook | null }

type Entry = AchievementProgress[string];

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const FIGHTER_COLOR_FIELDS: readonly (keyof FighterColors)[] = ['player', 'head', 'torso', 'arms', 'legs', 'jetpack'];
const MAX_SKIN_ID = 40;
const ACHIEVEMENT_ID_RE = /^[a-z0-9_]{1,40}$/;
const MAX_ACHIEVEMENTS = 200;
const BUILD_FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const BUILD_VALUE_RE = /^#?[A-Za-z0-9_-]{1,40}$/;
const MAX_BUILD_FIELDS = 40;

/** Names like "constructor" or "__proto__" would clash with plain-object lookups. */
const isSafeKey = (key: string, pattern: RegExp): boolean => pattern.test(key) && !(key in Object.prototype);

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
    let count = 0;
    for (const id of Object.keys(raw)) {
        if (count >= MAX_ACHIEVEMENTS) break;
        if (!isSafeKey(id, ACHIEVEMENT_ID_RE)) continue;
        const entry = sanitizeEntry(raw[id]);
        if (entry) { result[id] = entry; count += 1; }
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

const isBuildValue = (v: unknown): v is string | number =>
    (typeof v === 'string' && BUILD_VALUE_RE.test(v)) || (typeof v === 'number' && Number.isFinite(v));

/**
 * The build as stored, not as the game uses it: fields are repaired by sanitizeBuild, then every
 * well-formed field is carried through as it was, even one this build does not know (a newer part or
 * slot). The value is typed FighterBuild but may hold such parts: the game sanitizes on every load.
 */
function storedBuild(raw: Record<string, unknown>): FighterBuild {
    const build: Record<string, unknown> = { ...sanitizeBuild(raw, DEFAULT_BUILD) };
    for (const key of Object.keys(raw).slice(0, MAX_BUILD_FIELDS)) {
        if (isSafeKey(key, BUILD_FIELD_RE) && isBuildValue(raw[key])) build[key] = raw[key];
    }
    return build as unknown as FighterBuild;
}

function sanitizeLook(raw: unknown): FighterLook | null {
    if (!isRecord(raw) || !isRecord(raw.build) || !isCount(raw.savedAt)) return null;
    const { skinId } = raw;
    if (typeof skinId !== 'string' || skinId.length === 0 || skinId.length > MAX_SKIN_ID) return null;
    const colors = sanitizeColors(raw.colors);
    if (!colors) return null;
    return { build: storedBuild(raw.build), skinId, colors, savedAt: raw.savedAt };
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

/**
 * A tie keeps `b` (the cloud copy, at every call site): equal stamps mean one side copied the other, and
 * a local copy may have lost parts an older build could not keep.
 */
function mergeLooks(a: FighterLook | null, b: FighterLook | null): FighterLook | null {
    const winner = !a ? b : !b ? a : a.savedAt > b.savedAt ? a : b;
    return winner ? copyLook(winner) : null;
}

/**
 * Never lowers anything: max progress and XP, unlocked if either side unlocked, newest look wins
 * (`b` on a tie: pass the cloud copy, or the account's pending copy, as `b`).
 */
export function mergeSnapshots(a: PlayerSnapshot, b: PlayerSnapshot): PlayerSnapshot {
    const achievements: AchievementProgress = {};
    for (const id of new Set([...Object.keys(a.achievements), ...Object.keys(b.achievements)])) {
        achievements[id] = mergeEntry(a.achievements[id], b.achievements[id]);
    }
    return { achievements, xp: Math.max(a.xp, b.xp), look: mergeLooks(a.look, b.look) };
}
