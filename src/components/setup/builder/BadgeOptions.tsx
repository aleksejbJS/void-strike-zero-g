// Extra choices of the shoulder badge: the number (0..99) for the number badge, the symbol for the emblem badge.

import React from 'react';
import { EMBLEMS, EmblemId, FighterBuild } from '../../../game/build/buildParts';
import { TranslationKeys } from '../../../i18n/locales';
import { useTranslation } from '../../../i18n/useTranslation';

interface Props {
    build: FighterBuild;
    onBuild: (patch: Partial<FighterBuild>) => void;
}

const MAX_NUMBER = 99;
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-chalk';

/** Whole number in 0..99; anything unreadable counts as 0. */
export const clampBadgeNumber = (raw: string): number => {
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) ? Math.min(MAX_NUMBER, Math.max(0, n)) : 0;
};

export const BadgeOptions: React.FC<Props> = ({ build, onBuild }) => {
    const { t } = useTranslation();
    if (build.badge === 'number') {
        return (
            <div className="flex items-center gap-3">
                <label htmlFor="badge-number" className="text-base font-semibold">{t('cs.badgeNumber')}</label>
                <input id="badge-number" type="number" inputMode="numeric" min={0} max={MAX_NUMBER} step={1} value={build.badgeNumber}
                    onChange={e => onBuild({ badgeNumber: clampBadgeNumber(e.target.value) })}
                    className="h-11 w-20 rounded border-2 border-bay-edge bg-bay-steel px-3 text-lg font-semibold text-bay-chalk focus:border-bay-hazard focus:outline-none" />
            </div>
        );
    }
    if (build.badge !== 'emblem') return null;
    return (
        <div role="radiogroup" aria-label={t('cs.part.badge.emblem')} className="flex flex-wrap gap-2">
            {EMBLEMS.map((id: EmblemId) => {
                const on = build.emblem === id;
                return (
                    <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onBuild({ emblem: id })}
                        className={`ap-button h-11 rounded border-2 px-4 text-sm font-semibold ${on ? 'border-bay-hazard bg-bay-steel' : 'border-bay-edge hover:bg-bay-steel'} ${focusRing}`}>
                        {t(`cs.emblem.${id}` as keyof TranslationKeys)}
                    </button>
                );
            })}
        </div>
    );
};
