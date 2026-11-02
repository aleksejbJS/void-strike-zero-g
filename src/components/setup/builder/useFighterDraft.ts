// Editable fighter on the setup screen: the preset it started from, its build and its body colours.
// Picking a preset replaces everything; any later edit marks the preset as changed.

import { useState } from 'react';
import { SKINS } from '../../../constants';
import { FighterBuild } from '../../../game/build/buildParts';
import { presetBuild } from '../../../game/build/buildPresets';
import { currentBuild } from '../../../game/build/currentBuild';
import { BodyColor } from '../colorPresets';

interface Draft {
    presetIndex: number;
    build: FighterBuild;
    colors: Record<BodyColor, string>;
    changed: boolean;
}

const sameBuild = (a: FighterBuild, b: FighterBuild) =>
    (Object.keys(a) as (keyof FighterBuild)[]).every(key => a[key] === b[key]);

const presetColors = (index: number): Record<BodyColor, string> => {
    const { palette } = SKINS[index];
    return { torso: palette.torso, head: palette.head, arms: palette.arms, legs: palette.legs, jetpack: palette.jetpack };
};

/** `skinId` and `colors` are the saved choices; the saved build is loaded with locked parts already removed. */
export const useFighterDraft = (skinId: string, colors: Record<BodyColor, string>) => {
    const [draft, setDraft] = useState<Draft>(() => {
        const presetIndex = Math.max(0, SKINS.findIndex(s => s.id === skinId));
        const build = currentBuild();
        // Colours saved before presets existed are not compared: a fresh player would show as changed.
        return { presetIndex, build, colors, changed: !sameBuild(build, presetBuild(SKINS[presetIndex].id)) };
    });

    // Functional updates: rapid clicks on the arrows each count
    return {
        ...draft,
        preset: SKINS[draft.presetIndex],
        stepPreset: (step: number) => setDraft(d => {
            const presetIndex = (d.presetIndex + step + SKINS.length) % SKINS.length;
            return { presetIndex, build: presetBuild(SKINS[presetIndex].id), colors: presetColors(presetIndex), changed: false };
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
