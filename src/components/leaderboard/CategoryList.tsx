// The six boards of the Top screen: a column of metal plates left of the table, like the menu's mode list.
// On a narrow portrait screen: a wrapping row of tabs above the table. The picked board is painted yellow.

import React from 'react';
import type { RankedStat } from '../../leaderboard/leaderboardApi';
import type { Translate } from '../menu/types';
import { BOARD_CATEGORIES, categoryLabelKey } from './boardCategories';

interface Props {
    selected: RankedStat;
    onSelect: (stat: RankedStat) => void;
    t: Translate;
}

export const CategoryList: React.FC<Props> = ({ selected, onSelect, t }) => (
    <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:flex-nowrap sm:gap-2.5 phone:gap-1.5">
        {BOARD_CATEGORIES.map(stat => {
            const on = stat === selected;
            return (
                <button key={stat} type="button" aria-pressed={on} onClick={() => onSelect(stat)}
                    className={`ap-button ap-board-tab flex h-10 min-w-0 items-center px-3.5 text-left sm:h-12 sm:px-4 phone:h-8 phone:px-2.5 ${on ? '' : 'text-bay-chalk'}`}>
                    <span className="truncate">{t(categoryLabelKey(stat))}</span>
                </button>
            );
        })}
    </div>
);
