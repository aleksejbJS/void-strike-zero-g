// XP earned in the match that just ended, plus the level reached and any parts it opened.
// Shown on every end screen (score/time-limited result, Hunger Games round, Gun Game winner).

import React from 'react';
import type { Reward } from '../../game/build/progress';
import type { UnlockItem } from '../../game/build/unlocks';
import type { TranslationKeys } from '../../i18n/locales';
import type { Translate } from '../menu/types';

/** Display name of an opened part: the builder strings carry one name per catalogue part. */
const partName = (t: Translate, item: UnlockItem) => t(`cs.part.${item.slot}.${item.id}` as keyof TranslationKeys);

export const RewardPanel: React.FC<{ t: Translate; reward: Reward }> = ({ t, reward }) => (
    <div role="status" className="flex w-full flex-col items-center gap-1 border-y border-bay-plate px-7 py-3">
        <span className="font-display text-3xl font-black text-bay-hazard">{t('rw.gained', reward.gained)}</span>
        {reward.levelAfter > reward.levelBefore && (
            <span className="font-display text-lg font-extrabold">{t('rw.level', reward.levelAfter)}</span>
        )}
        {reward.unlocked.map(item => (
            <span key={`${item.slot}:${item.id}`} className="text-sm font-semibold text-lime-300">{t('rw.unlocked', partName(t, item))}</span>
        ))}
    </div>
);
