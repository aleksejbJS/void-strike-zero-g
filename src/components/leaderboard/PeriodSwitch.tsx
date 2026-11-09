// This week / This month / All time: a three-way switch above the table.

import React from 'react';
import type { Period } from '../../leaderboard/leaderboardApi';
import type { Translate } from '../menu/types';
import { BOARD_PERIODS, periodLabelKey } from './boardCategories';

interface Props {
    selected: Period;
    onSelect: (period: Period) => void;
    t: Translate;
}

export const PeriodSwitch: React.FC<Props> = ({ selected, onSelect, t }) => (
    <div className="flex w-fit max-w-full rounded border-2 border-bay-edge bg-bay-steel p-0.5">
        {BOARD_PERIODS.map(period => {
            const on = period === selected;
            return (
                <button key={period} type="button" aria-pressed={on} onClick={() => onSelect(period)}
                    className={`h-9 min-w-0 truncate rounded-sm px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bay-hazard phone:h-7 phone:px-3 phone:text-[13px] ${on ? 'bg-bay-hazard text-bay-ink' : 'text-bay-chalk hover:bg-bay-plate'}`}>
                    {t(periodLabelKey(period))}
                </button>
            );
        })}
    </div>
);
