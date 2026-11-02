// Makes any untrusted value (saved JSON, a network message) into a valid FighterBuild.
// Every field is checked on its own: a bad one falls back, the good ones are kept.

import { DEFAULT_BUILD, EMBLEMS, FighterBuild, SLOTS, Slot } from './buildParts';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_BADGE_NUMBER = 99;

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
    typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;

const pickColor = (value: unknown, fallback: string): string =>
    typeof value === 'string' && COLOR_RE.test(value) ? value : fallback;

const pickBadgeNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(MAX_BADGE_NUMBER, Math.max(0, Math.trunc(value)))
        : fallback;

export function sanitizeBuild(raw: unknown, fallback: FighterBuild = DEFAULT_BUILD): FighterBuild {
    if (!isRecord(raw)) return { ...fallback };

    const result: FighterBuild = {
        ...fallback,
        badgeNumber: pickBadgeNumber(raw.badgeNumber, fallback.badgeNumber),
        emblem: pick(EMBLEMS, raw.emblem, fallback.emblem),
        visorColor: pickColor(raw.visorColor, fallback.visorColor),
        patternColor: pickColor(raw.patternColor, fallback.patternColor),
    };
    for (const slot of Object.keys(SLOTS) as Slot[]) {
        // One cast per slot: the slot key ties the list to the matching field type.
        (result[slot] as string) = pick(SLOTS[slot] as readonly string[], raw[slot], fallback[slot]);
    }
    return result;
}
