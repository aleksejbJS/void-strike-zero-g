// One achievement tile: border by rarity; a locked one is greyed and shows its progress.

import React from 'react';
import { Achievement } from '../../game/systems/achievements';
import type { Translate } from '../menu/types';
import { progressLabel } from './achievementProgress';

const RARITY_BORDER: Record<Achievement['rarity'], string> = {
    common: 'border-bay-edge',
    rare: 'border-[#3D7BD9]',
    epic: 'border-[#A35BE0]',
    legendary: 'border-bay-hazard',
};

export const AchievementCard: React.FC<{ achievement: Achievement; t: Translate }> = ({ achievement: a, t }) => {
    const percent = a.maxProgress > 0 ? Math.min(100, Math.round((a.progress / a.maxProgress) * 100)) : 0;
    const label = progressLabel(a, t);
    return (
        <li className={`flex min-w-0 flex-col gap-0.5 rounded border-2 bg-bay-steel p-2.5 phone:p-1.5 ${RARITY_BORDER[a.rarity]} ${a.unlocked ? '' : 'opacity-[0.55] grayscale'}`}>
            <span aria-hidden="true" className="text-[26px] leading-none phone:text-lg">{a.icon}</span>
            <b className="font-display text-lg font-extrabold leading-tight phone:text-sm">{a.name}</b>
            <span className="text-[13px] leading-snug text-bay-dust phone:text-[11px] phone:leading-tight">{a.description}</span>
            {a.unlocked ? (
                <span className="mt-auto pt-1 text-[13px] font-semibold text-bay-hazard phone:text-[11px]">
                    {t('hud.unlocked')}{a.reward ? ` +${a.reward.xp} XP` : ''}
                </span>
            ) : (
                <div className="mt-auto flex flex-col gap-1 pt-1">
                    <span className="text-[13px] font-semibold phone:text-[11px]">{label}</span>
                    <div role="progressbar" aria-label={a.name} aria-valuemin={0} aria-valuemax={a.maxProgress} aria-valuenow={a.progress} aria-valuetext={label}
                        className="h-[5px] overflow-hidden rounded-sm bg-bay-deep">
                        <div className="h-full bg-bay-hazard" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            )}
        </li>
    );
};
