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
    <div className="ap-modes ap-panel flex flex-col gap-2 phone:gap-1">
        <h2 className="ap-section-label m-0 mb-1.5 font-display text-[26px] font-extrabold phone:sr-only">{title}</h2>
        {MODE_ORDER.map(mode => {
            const on = mode === selected;
            return (
                <button key={mode} type="button" aria-pressed={on} onClick={() => onSelect(mode)}
                    className={`ap-mode-button flex h-[66px] flex-col justify-center gap-0.5 rounded px-[18px] text-left phone:h-8 phone:px-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard ${on ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk hover:bg-bay-plate'}`}>
                    <ModeIcon mode={mode} />
                    <span className="ap-mode-copy">
                        <span className="truncate font-display text-[26px] font-black leading-none phone:text-base">{info[mode].name}</span>
                        <span className={`text-[13px] font-medium phone:hidden ${on ? 'text-[#2A2410]' : 'text-bay-dust'}`}>{info[mode].meta}</span>
                    </span>
                </button>
            );
        })}
    </div>
);

const SYMBOLS: Partial<Record<GameMode, React.ReactNode>> = {
    [GameMode.DEATHMATCH]: <><path d="M7 15C1 7 7 2 12 2s11 5 5 13v5H7z"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="m10 15 2-2 2 2M10 17v3m4-3v3"/></>,
    [GameMode.GUN_GAME]: <><path d="M3 7h18v6H9l-2 7H3l3-9H3z"/><path d="M12 13v3h4l2-3"/></>,
    [GameMode.CTF]: <><path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0"/></>,
    [GameMode.HOLD_THE_FLAG]: <><path d="M3 3 21 21M21 3 3 21M4 4l7-1-4 8m13-7-7-1 4 8"/></>,
    [GameMode.INFILTRATION]: <><path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6z"/><path d="M12 5v14"/></>,
    [GameMode.HUNGER_GAMES]: <><path d="M7 3h10v7c0 7-10 7-10 0zM7 5H3v4c0 3 4 3 4 3m10-7h4v4c0 3-4 3-4 3m-5 2v7m-5 0h10"/></>,
};
const ModeIcon: React.FC<{ mode: GameMode }> = ({ mode }) => (
    <svg className="ap-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{SYMBOLS[mode]}</svg>
);
