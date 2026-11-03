// Center of the menu: an animation of how the selected mode plays (drawn by the game itself
// where a live scene exists, schematic otherwise), plus its description and three key rules.

import React from 'react';
import { GameMode, MapId } from '../../types';
import { Stage } from './previewParts';
import { DeathmatchScene, GunGameScene, HungerScene } from './scenesSolo';
import { CtfScene, HoldFlagScene, InfiltrationScene } from './scenesTeam';
import { ModeInfo } from './modeInfo';
import type { Translate } from './types';
import { LIVE_SCENES } from './preview/liveScenes';
import { LiveStage } from './preview/LiveStage';

const SCENES: Record<GameMode, React.FC<{ t: Translate }>> = {
    [GameMode.DEATHMATCH]: DeathmatchScene,
    [GameMode.GUN_GAME]: GunGameScene,
    [GameMode.CTF]: CtfScene,
    [GameMode.HOLD_THE_FLAG]: HoldFlagScene,
    [GameMode.INFILTRATION]: InfiltrationScene,
    [GameMode.HUNGER_GAMES]: HungerScene,
};

export const ModePreview: React.FC<{ mode: GameMode; map: MapId; info: ModeInfo; t: Translate }> = ({ mode, map, info, t }) => {
    const Scene = SCENES[mode];
    const live = LIVE_SCENES[mode];
    const label = t('hb.previewLabel', info.name);
    return (
        <div className="flex min-w-0 flex-col gap-4 phone:gap-1.5">
            {/* key: restart the animations when the mode or map changes */}
            {live
                ? <LiveStage key={`${mode}-${map}`} mode={mode} map={map} live={live} label={label} t={t} Schematic={Scene} />
                : <Stage key={mode} label={label}><Scene t={t} /></Stage>}
            <div className="flex flex-col gap-2">
                <h2 className="m-0 font-display text-[38px] font-black leading-none phone:sr-only">{info.name}</h2>
                <p className="m-0 text-[17px] text-bay-dust phone:text-xs phone:leading-snug">{info.desc}</p>
                <ul className="m-0 mt-1.5 flex phone:hidden list-none flex-col gap-1.5 p-0">
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
