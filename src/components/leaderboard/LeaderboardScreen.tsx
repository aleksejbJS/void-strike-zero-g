// Top screen (atompunk design, layout B): the six boards as a list on the left, the period switch and
// the top-10 table on the right, with the viewer's own place under it. Narrow portrait: the list becomes tabs.

import React, { useState } from 'react';
import { useAccount } from '../../account/useAccount';
import { useTranslation } from '../../i18n/useTranslation';
import { MenuScreenHeader } from '../menu/MenuScreenHeader';
import './atompunk-leaderboard.css';
import type { Period, RankedStat } from '../../leaderboard/leaderboardApi';
import { BoardTable } from './BoardTable';
import { CategoryList } from './CategoryList';
import { PeriodSwitch } from './PeriodSwitch';
import { categoryLabelKey, DEFAULT_CATEGORY, DEFAULT_PERIOD } from './boardCategories';
import { useBoard } from './useBoard';
import type { Viewer } from './OwnPlace';

export const LeaderboardScreen: React.FC<{ onBack: () => void; onRegister: () => void }> = ({ onBack, onRegister }) => {
    const { t } = useTranslation();
    const { status, nickname } = useAccount();
    const [stat, setStat] = useState<RankedStat>(DEFAULT_CATEGORY);
    const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
    const { state, retry } = useBoard(stat, period);

    const viewer: Viewer = status === 'loggedIn' && nickname !== null ? { kind: 'player', nickname }
        : status === 'guest' ? { kind: 'guest' } : { kind: 'unknown' };

    return (
        <div className="atompunk-ui h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="ap-page-shell mx-auto flex min-h-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-6 sm:px-10 lg:px-[72px] lg:pt-8 phone:gap-2 phone:px-3 phone:pb-2 phone:pt-2">
                <MenuScreenHeader title={t('lb.title')} backLabel={t('lb.back')} onBack={onBack} />

                {/* Two riveted panels like the profile: the boards on the left, the switch and the table on the
                    right. Narrow portrait: stacked, the boards become a wrapping row of tabs. */}
                <main className="grid grid-cols-1 items-start gap-6 sm:grid-cols-[260px_minmax(0,1fr)] phone:grid-cols-[minmax(0,180px)_minmax(0,1fr)] phone:gap-3">
                    <div className="ap-panel ap-board-panel min-w-0 p-4 phone:p-2">
                        <CategoryList selected={stat} onSelect={setStat} t={t} />
                    </div>
                    <div className="ap-panel ap-board-panel flex min-w-0 flex-col gap-4 p-4 phone:gap-2 phone:p-2">
                        <PeriodSwitch selected={period} onSelect={setPeriod} t={t} />
                        <BoardTable valueLabel={t(categoryLabelKey(stat))} state={state} viewer={viewer} onRetry={retry} onRegister={onRegister} t={t} />
                    </div>
                </main>
            </div>
        </div>
    );
};
