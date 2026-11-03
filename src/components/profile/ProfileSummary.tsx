// Left column of the profile: name, title, fighter level and the two achievement tiles.
// The account buttons (children) go under the tiles.

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { XpBar } from '../setup/builder/XpBar';
import type { ProfileData } from './profileData';

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex min-w-0 flex-col gap-0.5 rounded border-2 border-bay-edge bg-bay-panel px-3 py-2 phone:px-2 phone:py-1">
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-bay-dust phone:text-[9px]">{label}</span>
        <span className="font-display text-[28px] font-black leading-none phone:text-lg">{value}</span>
    </div>
);

interface Props {
    nickname: string;
    data: ProfileData;
    children?: React.ReactNode;
}

export const ProfileSummary: React.FC<Props> = ({ nickname, data, children }) => {
    const { t } = useTranslation();
    return (
        <section className="flex min-w-0 flex-col gap-3 phone:gap-1.5">
            <h1 className="m-0 break-words font-display text-[44px] font-black uppercase leading-[0.9] sm:text-[52px] phone:text-2xl">{nickname}</h1>
            {data.title && <p className="m-0 -mt-1 text-sm font-semibold text-bay-hazard phone:text-xs">{t('pf.title', data.title)}</p>}
            <div className="rounded border-2 border-bay-edge bg-bay-panel px-3 py-2 phone:px-2 phone:py-1">
                <XpBar xp={data.fighterXp} />
            </div>
            <div className="grid grid-cols-2 gap-2 phone:gap-1.5">
                <Tile label={t('pf.stat.achievements')} value={`${data.unlockedCount}/${data.achievements.length}`} />
                <Tile label={t('pf.stat.xp')} value={String(data.achievementXp)} />
            </div>
            {children}
        </section>
    );
};
