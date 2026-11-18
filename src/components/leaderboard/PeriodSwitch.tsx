// This week / This month / All time: a row of metal chips above the table, the picked one painted yellow.

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
    <div className="flex max-w-full flex-wrap gap-2 phone:gap-1.5">
        {BOARD_PERIODS.map(period => {
            const on = period === selected;
            return (
                <button key={period} type="button" aria-pressed={on} onClick={() => onSelect(period)}
                    className={`ap-button h-10 min-w-0 truncate px-4 phone:h-7 phone:px-3 ${on ? '' : 'text-bay-chalk'}`}>
                    {t(periodLabelKey(period))}
                </button>
            );
        })}
    </div>
);
