// Left column of the menu: the six game modes as plates; the selected one is hazard yellow.

import React from 'react';
import { MenuModeIcon } from './MenuModeIcon';
import { GameMode } from '../../types';
import { ModeInfo, MODE_ORDER } from './modeInfo';

interface Props {
    title: string;
    selected: GameMode;
    info: Record<GameMode, ModeInfo>;
    onSelect: (mode: GameMode) => void;
}

export const ModeList: React.FC<Props> = ({ title, selected, info, onSelect }) => (
    <div className="ap-modes ap-panel flex flex-col gap-2 phone:gap-1">
        <h2 className="ap-section-label ap-painted-plate m-0 mb-1.5 font-display text-[26px] font-extrabold phone:sr-only"><MenuModeIcon emblem="crosshair" className="ap-title-emblem" /><span>{title}</span></h2>
        {MODE_ORDER.map(mode => {
            const on = mode === selected;
            return (
                <button key={mode} type="button" aria-pressed={on} onClick={() => onSelect(mode)}
                    className={`ap-mode-button flex h-[66px] flex-col justify-center gap-0.5 rounded px-[18px] text-left phone:h-8 phone:px-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard ${on ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk hover:bg-bay-plate'}`}>
                    <MenuModeIcon emblem={mode} className="ap-mode-icon ap-stencil-icon" />
                    <span className="ap-mode-copy">
                        <span className="truncate font-display text-[26px] font-black leading-none phone:text-base">{info[mode].name}</span>
                        <span className={`text-[13px] font-medium phone:hidden ${on ? 'text-[#2A2410]' : 'text-bay-dust'}`}>{info[mode].meta}</span>
                    </span>
                </button>
            );
        })}
    </div>
);
