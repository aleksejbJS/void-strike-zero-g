// Modes whose preview is drawn live by the game's renderer: the script to play and the HTML
// texts laid over it. Modes missing here keep their schematic scene.

import React from 'react';
import { GameMode } from '../../../types';
import { DeathmatchOverlay } from '../scenesSolo';
import type { Translate } from '../types';
import { ModeScript } from './previewScript';
import { CtfOverlay, GunGameOverlay, HoldFlagOverlay, HungerOverlay, InfiltrationOverlay } from './liveOverlays';
import { deathmatchScript } from './scripts/deathmatch';
import { gunGameScript } from './scripts/gunGame';
import { ctfScript } from './scripts/ctf';
import { holdFlagScript } from './scripts/holdFlag';
import { infiltrationScript } from './scripts/infiltration';
import { hungerScript } from './scripts/hunger';

export interface LiveScene {
    script: ModeScript;
    Overlay: React.FC<{ t: Translate }>;
}

export const LIVE_SCENES: Partial<Record<GameMode, LiveScene>> = {
    [GameMode.DEATHMATCH]: { script: deathmatchScript, Overlay: DeathmatchOverlay },
    [GameMode.GUN_GAME]: { script: gunGameScript, Overlay: GunGameOverlay },
    [GameMode.CTF]: { script: ctfScript, Overlay: CtfOverlay },
    [GameMode.HOLD_THE_FLAG]: { script: holdFlagScript, Overlay: HoldFlagOverlay },
    [GameMode.INFILTRATION]: { script: infiltrationScript, Overlay: InfiltrationOverlay },
    [GameMode.HUNGER_GAMES]: { script: hungerScript, Overlay: HungerOverlay },
};
