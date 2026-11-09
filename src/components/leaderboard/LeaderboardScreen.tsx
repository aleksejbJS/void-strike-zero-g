// Top screen ("Hazard Bay" design, layout B): the six boards as a list on the left, the period switch and
// the top-10 table on the right, with the viewer's own place under it. On a phone the list becomes tabs.

import React, { useState } from 'react';
import { useAccount } from '../../account/useAccount';
import { useTranslation } from '../../i18n/useTranslation';
import type { Period, RankedStat } from '../../leaderboard/leaderboardApi';
import { BoardTable } from './BoardTable';
import { CategoryList } from './CategoryList';
import { PeriodSwitch } from './PeriodSwitch';
import { categoryLabelKey, DEFAULT_CATEGORY, DEFAULT_PERIOD } from './boardCategories';
import { useBoard } from './useBoard';
import type { Viewer } from './OwnPlace';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

export const LeaderboardScreen: React.FC<{ onBack: () => void; onRegister: () => void }> = ({ onBack, onRegister }) => {
    const { t } = useTranslation();
    const { status, nickname } = useAccount();
    const [stat, setStat] = useState<RankedStat>(DEFAULT_CATEGORY);
    const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
    const { state, retry } = useBoard(stat, period);

    const viewer: Viewer = status === 'loggedIn' && nickname !== null ? { kind: 'player', nickname }
        : status === 'guest' ? { kind: 'guest' } : { kind: 'unknown' };

    return (
        <div className="h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="mx-auto flex min-h-full max-w-[1120px] flex-col gap-3 px-4 pb-6 pt-5 sm:px-10 lg:pt-6 phone:gap-2 phone:px-3 phone:pb-3 phone:pt-2">
                <header className="flex flex-col items-start gap-2 phone:flex-row phone:items-center phone:gap-4">
                    <button type="button" onClick={onBack} className={`text-[15px] font-semibold text-bay-hazard hover:text-bay-chalk phone:text-sm ${focusRing}`}>
                        {t('lb.back')}
                    </button>
                    <h1 className="m-0 font-display text-[44px] font-black uppercase leading-none sm:text-[52px] phone:text-[26px]">{t('lb.title')}</h1>
                </header>
                <div aria-hidden="true" className="hazard-stripes-sm h-2 w-[260px] max-w-full phone:hidden" />

                {/* Laptop: the list on the left, the switch and the table on the right. Narrow portrait: all stacked.
                    Phone held sideways: the right column dissolves (display: contents), so the category tabs and
                    the period switch share one wrapping row above the full-width table. */}
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:gap-6 phone:flex-row phone:flex-wrap phone:items-center phone:gap-2 phone:pt-0">
                    <CategoryList selected={stat} onSelect={setStat} t={t} />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 phone:contents">
                        <PeriodSwitch selected={period} onSelect={setPeriod} t={t} />
                        <div className="min-w-0 phone:basis-full">
                            <BoardTable valueLabel={t(categoryLabelKey(stat))} state={state} viewer={viewer} onRetry={retry} onRegister={onRegister} t={t} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
