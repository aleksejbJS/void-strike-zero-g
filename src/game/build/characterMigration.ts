// A legacy preset's defaults become source-neutral art; actual custom parts and colours survive.

import { SKINS } from '../../constants';
import { FighterBuild } from './buildParts';
import { presetBuild } from './buildPresets';
import type { BodyId } from './bodyTypes';
import { BaseColors, BODY_PRESETS, ROBOT_LEGACY_PALETTE } from './characterBases';

export interface CharacterMigrationContext { headIsFallback?: boolean }

export const sameBuild = (a: FighterBuild, b: FighterBuild): boolean =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .every(key => a[key as keyof FighterBuild] === b[key as keyof FighterBuild]);

type RobotColors = Pick<BaseColors, keyof typeof ROBOT_LEGACY_PALETTE>;

/** A robot still wearing the painted robot's default colours gets the 3D kit's defaults; chosen colours stay. */
export function migrateRobotDefaults<T extends RobotColors>(colors: T, body: BodyId | undefined): T {
    if (body !== 'robot') return colors;
    const kit = BODY_PRESETS.find(preset => preset.body === 'robot')!.palette;
    const next = { ...colors };
    for (const part of Object.keys(ROBOT_LEGACY_PALETTE) as (keyof RobotColors)[]) {
        if (colors[part].toLowerCase() === ROBOT_LEGACY_PALETTE[part]) next[part] = kit[part];
    }
    return next;
}

export function migrateCharacter(skinId: string, build: FighterBuild, savedColors: BaseColors, context: CharacterMigrationContext = {}) {
    const skin = SKINS.find(preset => preset.id === skinId) ?? SKINS[0];
    const body = build.body ?? BODY_PRESETS.find(preset => preset.id === skinId)?.body
        ?? (skin.style === 'robot' ? 'robot' : skin.style === 'alien' ? 'toxic' : skin.style === 'beast' ? 'cat' : 'human');
    const presetIndex = BODY_PRESETS.findIndex(preset => preset.body === body);
    const colors = migrateRobotDefaults(savedColors, body);
    const preset = BODY_PRESETS[presetIndex];
    if (build.body) return { presetIndex, build, colors };

    const legacy = presetBuild(skin.id);
    const canonical = presetBuild(preset.id);
    const defaults = Object.fromEntries(Object.entries(canonical).filter(([key]) =>
        key !== 'body' && build[key as keyof FighterBuild] === legacy[key as keyof FighterBuild]));
    const migratedColors = { ...colors };
    for (const part of Object.keys(preset.palette) as (keyof BaseColors)[]) {
        // A saved blue head can be a custom colour; only migrate a proven fresh-player fallback.
        const freshHead = context.headIsFallback && skin.id === 'classic' && part === 'head' && colors.head.toLowerCase() === '#3b82f6';
        if (colors[part].toLowerCase() === skin.palette[part].toLowerCase() || freshHead) {
            migratedColors[part] = preset.palette[part];
        }
    }
    return { presetIndex, build: { ...build, ...defaults, body }, colors: migratedColors };
}
