// Left column of the menu: the six game modes as plates; the selected one is hazard yellow.

import React from 'react';
import { GameMode } from '../../types';
import { ModeInfo, MODE_ORDER } from './modeInfo';

interface Props {
    title: string;
    selected: GameMode;
    info: Record<GameMode, ModeInfo>;
    onSelect: (mode: GameMode) => void;
}

export const ModeList: React.FC<Props> = ({ title, selected, info, onSelect }) => (
    <div className="flex flex-col gap-2">
        <h2 className="m-0 mb-1.5 font-display text-[26px] font-extrabold">{title}</h2>
        {MODE_ORDER.map(mode => {
            const on = mode === selected;
            return (
                <button key={mode} type="button" aria-pressed={on} onClick={() => onSelect(mode)}
                    className={`flex h-[66px] flex-col justify-center gap-0.5 rounded px-[18px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard ${on ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk hover:bg-bay-plate'}`}>
                    <span className="font-display text-[26px] font-black leading-none">{info[mode].name}</span>
                    <span className={`text-[13px] font-medium ${on ? 'text-[#2A2410]' : 'text-bay-dust'}`}>{info[mode].meta}</span>
                </button>
            );
        })}
    </div>
);
