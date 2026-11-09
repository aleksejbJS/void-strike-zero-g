// The six boards of the Top screen. On a laptop: a column of plates left of the table, like the menu's
// mode list. On a narrow portrait screen or a phone held sideways: a wrapping row of tabs above the table.

import React from 'react';
import type { RankedStat } from '../../leaderboard/leaderboardApi';
import type { Translate } from '../menu/types';
import { BOARD_CATEGORIES, categoryLabelKey } from './boardCategories';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

interface Props {
    selected: RankedStat;
    onSelect: (stat: RankedStat) => void;
    t: Translate;
}

export const CategoryList: React.FC<Props> = ({ selected, onSelect, t }) => (
    <div className="flex flex-row flex-wrap gap-1.5 sm:w-[240px] sm:shrink-0 sm:flex-col sm:flex-nowrap sm:gap-2 phone:w-auto phone:flex-row phone:flex-wrap phone:gap-1">
        {BOARD_CATEGORIES.map(stat => {
            const on = stat === selected;
            return (
                <button key={stat} type="button" aria-pressed={on} onClick={() => onSelect(stat)}
                    className={`flex h-9 items-center rounded px-3 text-left text-sm font-semibold transition-colors sm:h-12 sm:px-4 sm:font-display sm:text-[22px] sm:font-black phone:h-8 phone:px-2.5 phone:font-body phone:text-[13px] phone:font-semibold ${focusRing} ${on ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk hover:bg-bay-plate'}`}>
                    <span className="truncate">{t(categoryLabelKey(stat))}</span>
                </button>
            );
        })}
    </div>
);
