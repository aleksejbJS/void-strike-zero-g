// One build slot as a grid of tiles: the picked part has a hazard border, locked parts are dimmed
// with a lock and the level that opens them, and cannot be picked.

import React, { useId } from 'react';
import { SLOTS, Slot } from '../../../game/build/buildParts';
import { isUnlocked, unlockLevel } from '../../../game/build/unlocks';
import { TranslationKeys } from '../../../i18n/locales';
import { useTranslation } from '../../../i18n/useTranslation';

interface Props {
    slot: Slot;
    value: string;
    level: number;
    thumbs?: Record<string, string>; // part id -> image URL
    onPick: (id: string) => void;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-chalk';

const LockIcon: React.FC = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
);

const tileClass = (picked: boolean, locked: boolean) => [
    'relative flex min-h-16 min-w-0 flex-col items-center justify-start gap-1 rounded border-2 bg-bay-steel px-1.5 py-1.5 text-center text-[13px] font-semibold leading-tight',
    picked ? 'border-bay-hazard text-bay-chalk' : 'border-transparent text-bay-chalk',
    locked ? 'cursor-not-allowed opacity-45' : 'hover:bg-bay-plate',
    focusRing,
].join(' ');

export const PartTiles: React.FC<Props> = ({ slot, value, level, thumbs, onPick }) => {
    const { t } = useTranslation();
    const headingId = useId();
    return (
        <section role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
            <h3 id={headingId} className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-bay-dust">
                {t(`cs.slot.${slot}` as keyof TranslationKeys)}
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {SLOTS[slot].map(id => {
                    const locked = !isUnlocked(slot, id, level);
                    const opensAt = unlockLevel(slot, id);
                    const picked = id === value;
                    return (
                        <button key={id} type="button" aria-pressed={picked} disabled={locked} onClick={() => onPick(id)}
                            title={locked ? t('cs.lockedHint', opensAt) : undefined} className={tileClass(picked, locked)}>
                            {thumbs?.[id] && <img src={thumbs[id]} alt="" draggable={false} className="aspect-square w-full max-w-16 object-contain" />}
                            <span className="break-words [hyphens:auto]">{t(`cs.part.${slot}.${id}` as keyof TranslationKeys)}</span>
                            {locked && (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-bay-dust">
                                    <LockIcon />{t('cs.lockedAt', opensAt)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
};
