// Center of the menu: a schematic animation of how the selected mode plays,
// plus its description and three key rules.

import React from 'react';
import { GameMode } from '../../types';
import { Stage } from './previewParts';
import { DeathmatchScene, GunGameScene, HungerScene } from './scenesSolo';
import { CtfScene, HoldFlagScene, InfiltrationScene } from './scenesTeam';
import { ModeInfo } from './modeInfo';
import type { Translate } from './types';

const SCENES: Record<GameMode, React.FC<{ t: Translate }>> = {
    [GameMode.DEATHMATCH]: DeathmatchScene,
    [GameMode.GUN_GAME]: GunGameScene,
    [GameMode.CTF]: CtfScene,
    [GameMode.HOLD_THE_FLAG]: HoldFlagScene,
    [GameMode.INFILTRATION]: InfiltrationScene,
    [GameMode.HUNGER_GAMES]: HungerScene,
};

export const ModePreview: React.FC<{ mode: GameMode; info: ModeInfo; t: Translate }> = ({ mode, info, t }) => {
    const Scene = SCENES[mode];
    return (
        <div className="flex min-w-0 flex-col gap-4">
            {/* key: restart the animations when the mode changes */}
            <Stage key={mode} label={t('hb.previewLabel', info.name)}>
                <Scene t={t} />
            </Stage>
            <div className="flex flex-col gap-2">
                <h2 className="m-0 font-display text-[38px] font-black leading-none">{info.name}</h2>
                <p className="m-0 text-[17px] text-bay-dust">{info.desc}</p>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0">
                    {info.rules.map(rule => (
                        <li key={rule} className="flex items-baseline gap-2.5 text-base leading-snug">
                            <span aria-hidden="true" className="h-2 w-2 shrink-0 -translate-y-px bg-bay-hazard" />
                            {rule}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
