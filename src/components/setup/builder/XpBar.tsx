// Fighter level and progress to the next unlocked part, under the preset arrows.

import React from 'react';
import { UNLOCK_ORDER, XP_PER_LEVEL, levelForXp } from '../../../game/build/unlocks';
import { useTranslation } from '../../../i18n/useTranslation';

const LAST_UNLOCK_LEVEL = Math.max(...UNLOCK_ORDER.map(item => item.level));

export const XpBar: React.FC<{ xp: number }> = ({ xp }) => {
    const { t } = useTranslation();
    const level = levelForXp(xp);
    const allOpen = level >= LAST_UNLOCK_LEVEL;
    // Every level up to the last unlock opens one part, so the next part is the next level.
    const toNext = level * XP_PER_LEVEL - xp;
    const filled = allOpen ? 1 : 1 - toNext / XP_PER_LEVEL;
    return (
        <div className="ap-panel ap-xp flex flex-col gap-1.5 phone:gap-0.5">
            <span className="text-sm text-bay-dust phone:text-[10px]">{allOpen ? t('cs.allOpen', level) : t('cs.level', level, toNext)}</span>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-sm bg-bay-steel">
                <div className="h-full rounded-sm bg-bay-hazard" style={{ width: `${Math.round(filled * 100)}%` }} />
            </div>
        </div>
    );
};
