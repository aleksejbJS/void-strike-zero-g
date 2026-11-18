// Editable fighter on the setup screen: the preset it started from, its build and its body colours.
// Picking a preset replaces everything; any later edit marks the preset as changed.

import { useState } from 'react';
import { FighterBuild } from '../../../game/build/buildParts';
import { presetBuild } from '../../../game/build/buildPresets';
import { BODY_PRESETS, BodyPreset } from '../../../game/build/characterBases';
import { migrateCharacter, sameBuild } from '../../../game/build/characterMigration';
import { currentBuild } from '../../../game/build/currentBuild';
import { PLAYER_KEYS, readStored } from '../../../store/playerStorage';
import { BodyColor, BodyPart } from '../colorPresets';

interface Draft {
    presetIndex: number;
    build: FighterBuild;
    colors: Record<BodyColor, string>;
    changed: boolean;
}

interface FighterDraft extends Draft {
    preset: BodyPreset;
    originals: Record<BodyPart, string>;
    stepPreset: (step: number) => void;
    patchBuild: (patch: Partial<FighterBuild>) => void;
    setColor: (part: BodyColor, color: string) => void;
}

const presetColors = (index: number): Record<BodyColor, string> => {
    const { palette } = BODY_PRESETS[index];
    return { torso: palette.torso, head: palette.head, arms: palette.arms, legs: palette.legs, jetpack: palette.jetpack };
};

/** Every colour the preset starts with: its palette for the body, its starting build for visor and pattern. */
const presetOriginals = (index: number): Record<BodyPart, string> => {
    const { visorColor, patternColor } = presetBuild(BODY_PRESETS[index].id);
    return { ...presetColors(index), visor: visorColor, pattern: patternColor };
};

/** `skinId` and `colors` are the saved choices; the saved build is loaded with locked parts already removed. */
export const useFighterDraft = (skinId: string, colors: Record<BodyColor, string>): FighterDraft => {
    const [draft, setDraft] = useState<Draft>(() => {
        const migrated = migrateCharacter(skinId, currentBuild(), colors, {
            headIsFallback: readStored(PLAYER_KEYS.head) === null,
        });
        const preset = BODY_PRESETS[migrated.presetIndex];
        const changed = !sameBuild(migrated.build, presetBuild(preset.id))
            || (Object.keys(colors) as BodyColor[]).some(part => migrated.colors[part] !== preset.palette[part]);
        return { ...migrated, changed };
    });

    // Functional updates: rapid clicks on the arrows each count
    return {
        ...draft,
        preset: BODY_PRESETS[draft.presetIndex],
        originals: presetOriginals(draft.presetIndex),
        stepPreset: (step: number) => setDraft(d => {
            const presetIndex = (d.presetIndex + step + BODY_PRESETS.length) % BODY_PRESETS.length;
            return { presetIndex, build: presetBuild(BODY_PRESETS[presetIndex].id), colors: presetColors(presetIndex), changed: false };
        }),
        patchBuild: (patch: Partial<FighterBuild>) => setDraft(d => {
            const build = { ...d.build, ...patch };
            return { ...d, build, changed: d.changed || !sameBuild(build, d.build) };
        }),
        setColor: (part: BodyColor, color: string) => setDraft(d => ({
            ...d, colors: { ...d.colors, [part]: color }, changed: d.changed || d.colors[part] !== color,
        })),
    };
};
