// Top-right HUD controls (sound, achievements), the "achievement unlocked" toast
// and the achievements panel.

import React, { useEffect } from 'react';
import { Achievement, achievementManager } from '../../game/systems/achievements';
import type { Translate } from '../menu/types';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard';
const iconButton = `pointer-events-auto flex h-11 w-11 items-center justify-center rounded bg-bay-ink/90 text-bay-chalk hover:bg-bay-steel ${FOCUS}`;
// Phone top bar: no plate, small icons, the full bar height to tap
const smallIconButton = `pointer-events-auto flex h-7 w-8 items-center justify-center text-bay-chalk ${FOCUS}`;

/** Show / hide the invite banner; present only while hosting a game that has a link */
export interface InviteToggle { open: boolean; onToggle: () => void }

export const HudButtons: React.FC<{ t: Translate; muted: boolean; onToggleMute: () => void; onOpenAchievements: () => void; invite?: InviteToggle; small?: boolean }> = ({ t, muted, onToggleMute, onOpenAchievements, invite, small }) => (
    <div className={`flex ${small ? '' : 'gap-2'}`}>
        {invite && (
            <button type="button" onClick={invite.onToggle} aria-label={t('hud.inviteButton')} aria-pressed={invite.open} className={small ? smallIconButton : iconButton}>
                <svg width={small ? 14 : 20} height={small ? 14 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1" /><path d="M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1" />
                </svg>
            </button>
        )}
        <button type="button" onClick={onToggleMute} aria-label={t('hud.sound')} aria-pressed={!muted} className={small ? smallIconButton : iconButton}>
            <svg width={small ? 14 : 20} height={small ? 14 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H3v6h3l5 4z" />
                {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 010 6M19 6a8 8 0 010 12" />}
            </svg>
        </button>
        <button type="button" onClick={onOpenAchievements} aria-label={t('hud.achievements')} className={small ? smallIconButton : iconButton}>
            <svg width={small ? 14 : 20} height={small ? 14 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 4h8v5a4 4 0 01-8 0z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8" />
            </svg>
        </button>
    </div>
);

export const AchievementToast: React.FC<{ t: Translate; achievement: Achievement }> = ({ t, achievement }) => (
    <div role="status" className="pointer-events-none flex max-w-xs flex-col rounded bg-bay-hazard px-3.5 py-2.5 text-bay-ink">
        <span className="text-[13px] font-semibold">{t('hud.achievementUnlocked')}</span>
        <span className="font-display text-2xl font-black leading-tight">{achievement.name}</span>
        <span className="text-sm">{achievement.description}{achievement.reward ? ` +${achievement.reward.xp} XP` : ''}</span>
    </div>
);

export const AchievementsPanel: React.FC<{ t: Translate; onClose: () => void }> = ({ t, onClose }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[rgba(10,12,15,0.75)] p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="achievements-title" onClick={e => e.stopPropagation()}
                className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded bg-bay-panel font-body text-bay-chalk">
                <div aria-hidden="true" className="hazard-stripes h-3 shrink-0" />
                <div className="flex items-center justify-between px-6 pb-2 pt-5">
                    <h2 id="achievements-title" className="m-0 font-display text-4xl font-black">{t('hud.achievements')}</h2>
                    <button type="button" onClick={onClose} aria-label={t('hud.close')} className={iconButton.replace('pointer-events-auto ', '')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 overflow-y-auto p-6 pt-2 md:grid-cols-2">
                    {achievementManager.getAchievements().map(a => (
                        <li key={a.id} className={`rounded p-3.5 ${a.unlocked ? 'bg-bay-steel' : 'bg-bay-ink'}`}>
                            <div className={`font-display text-xl font-extrabold ${a.unlocked ? 'text-bay-hazard' : 'text-bay-dust'}`}>{a.name}</div>
                            <div className="text-sm text-bay-dust">{a.description}</div>
                            <div className="mt-1.5 text-sm font-semibold">
                                {a.unlocked ? `${t('hud.unlocked')}${a.reward?.xp ? ` +${a.reward.xp} XP` : ''}` : t('hud.progress', a.progress, a.maxProgress)}
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="flex items-baseline justify-center gap-3 border-t border-bay-plate py-4">
                    <span className="text-sm text-bay-dust">{t('hud.totalXp')}</span>
                    <span className="font-display text-3xl font-black text-bay-hazard">{achievementManager.getTotalXP()} XP</span>
                    <span className="text-sm text-bay-dust">{t('hud.complete', achievementManager.getCompletionPercentage())}</span>
                </div>
            </div>
        </div>
    );
};

