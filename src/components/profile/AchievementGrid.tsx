// Category chips and the grid of all achievements.

import React, { useState } from 'react';
import type { Achievement, AchievementCategory } from '../../game/systems/achievements';
import { useTranslation } from '../../i18n/useTranslation';
import { AchievementCard } from './AchievementCard';

type Filter = 'all' | AchievementCategory;
const FILTERS: readonly Filter[] = ['all', 'combat', 'movement', 'modes', 'collecting', 'special'];

const chip = 'h-9 rounded border-2 px-3.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard phone:h-7 phone:px-2.5 phone:text-xs';

export const AchievementGrid: React.FC<{ achievements: readonly Achievement[] }> = ({ achievements }) => {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>('all');
    const shown = filter === 'all' ? achievements : achievements.filter(a => a.category === filter);

    return (
        <div className="flex min-w-0 flex-col gap-2.5 phone:gap-1.5">
            <div role="group" aria-label={t('pf.filters')} className="flex flex-wrap gap-1.5">
                {FILTERS.map(name => (
                    <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)}
                        className={`${chip} ${filter === name ? 'border-bay-hazard bg-bay-hazard text-bay-ink' : 'border-bay-edge bg-bay-steel hover:bg-bay-plate'}`}>
                        {t(`pf.filter.${name}`)}
                    </button>
                ))}
            </div>
            <ul aria-label={t('pf.list')} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 p-0 phone:grid-cols-[repeat(auto-fill,minmax(125px,1fr))] phone:gap-1.5">
                {shown.map(a => <AchievementCard key={a.id} achievement={a} t={t} />)}
            </ul>
        </div>
    );
};
