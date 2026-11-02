// XP earned in the match that just ended, plus the level reached and any parts it opened.
// Shown on every end screen (score/time-limited result, Hunger Games round, Gun Game winner).

import React from 'react';
import type { Reward } from '../../game/build/progress';
import type { UnlockItem } from '../../game/build/unlocks';
import type { TranslationKeys } from '../../i18n/locales';
import type { Translate } from '../menu/types';

/** Slot label and part name of an opened part: many names ("Blue", "Round") only make sense with their slot. */
const partLabel = (t: Translate, item: UnlockItem) =>
    t('rw.unlocked', t(`cs.slot.${item.slot}`), t(`cs.part.${item.slot}.${item.id}` as keyof TranslationKeys));

export const RewardPanel: React.FC<{ t: Translate; reward: Reward }> = ({ t, reward }) => (
    <div role="status" className="flex w-full flex-col items-center gap-1 border-y border-bay-plate px-7 py-3">
        <span className="font-display text-3xl font-black text-bay-hazard">{t('rw.gained', reward.gained)}</span>
        {reward.levelAfter > reward.levelBefore && (
            <span className="font-display text-lg font-extrabold">{t('rw.level', reward.levelAfter)}</span>
        )}
        {reward.unlocked.map(item => (
            <span key={`${item.slot}:${item.id}`} className="text-center text-sm font-semibold text-lime-300">{partLabel(t, item)}</span>
        ))}
    </div>
);
