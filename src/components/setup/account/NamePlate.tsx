// A logged-in player's name: a locked plate instead of the input, with a link to the profile.
// Renders two siblings (the plate and its note) so the parent row can lay them out.

import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

export const NamePlate: React.FC<{ nickname: string; onOpenProfile?: () => void }> = ({ nickname, onOpenProfile }) => {
    const { t } = useTranslation();
    return (
        <>
            <div className="flex h-[54px] min-w-0 items-center gap-2.5 rounded border-2 border-bay-hazard bg-bay-panel px-4 short:h-[46px] phone:h-8 phone:flex-1 phone:px-2">
                <span className="min-w-0 flex-1 truncate text-xl font-bold text-bay-chalk phone:text-sm">{nickname}</span>
                <span className="shrink-0 text-[13px] text-bay-hazard phone:text-xs">
                    <span aria-hidden="true">🔒</span> {t('ac.plate.tag')}
                </span>
            </div>
            <span className="text-[13px] text-bay-dust phone:text-xs">
                <span className="phone:hidden">{t('ac.plate.hint')} </span>
                {onOpenProfile && (
                    <button type="button" onClick={onOpenProfile}
                        className="font-semibold text-bay-hazard hover:text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard">
                        {t('ac.plate.profile')}
                    </button>
                )}
            </span>
        </>
    );
};
