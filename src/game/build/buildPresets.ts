// Starting build for each skin, so a player who only ever picked a skin keeps the look they know.
// Presets use free parts only; the skin's style decides helmet, ears and tail.

import { SKINS } from '../../constants';
import { DEFAULT_BUILD, FighterBuild } from './buildParts';
import { BODY_PRESETS } from './characterBases';

const NEUTRAL_COLOR = '#e5e7eb';
const HUMAN_VISOR = '#7fd3ff';

export function presetBuild(skinId: string): FighterBuild {
    const bodyPreset = BODY_PRESETS.find(preset => preset.id === skinId);
    if (bodyPreset) return { ...DEFAULT_BUILD, body: bodyPreset.body, helmet: 'none', visor: 'none' };
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin) return { ...DEFAULT_BUILD };

    const accent = skin.accent ?? NEUTRAL_COLOR;
    const base: FighterBuild = { ...DEFAULT_BUILD, patternColor: accent };

    switch (skin.style) {
        case 'robot':
            return { ...base, helmet: 'box', pattern: 'band', visorColor: accent };
        case 'beast':
            // Hammy the hamster is the one beast without a tail.
            return { ...base, ears: 'cat', tail: skin.id === 'hamster' ? 'none' : 'cat', visorColor: accent };
        case 'alien':
            return { ...base, ears: 'antennae', tail: 'tentacle', visorColor: accent };
        default:
            return { ...base, visorColor: HUMAN_VISOR };
    }
}
