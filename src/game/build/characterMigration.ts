// A legacy preset's defaults become source-neutral art; actual custom parts and colours survive.

import { SKINS } from '../../constants';
import { FighterBuild } from './buildParts';
import { presetBuild } from './buildPresets';
import { BaseColors, BODY_PRESETS } from './characterBases';

export interface CharacterMigrationContext { headIsFallback?: boolean }

export const sameBuild = (a: FighterBuild, b: FighterBuild): boolean =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .every(key => a[key as keyof FighterBuild] === b[key as keyof FighterBuild]);

export function migrateCharacter(skinId: string, build: FighterBuild, colors: BaseColors, context: CharacterMigrationContext = {}) {
    const skin = SKINS.find(preset => preset.id === skinId) ?? SKINS[0];
    const body = build.body ?? BODY_PRESETS.find(preset => preset.id === skinId)?.body
        ?? (skin.style === 'robot' ? 'robot' : skin.style === 'alien' ? 'toxic' : skin.style === 'beast' ? 'cat' : 'human');
    const presetIndex = BODY_PRESETS.findIndex(preset => preset.body === body);
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
