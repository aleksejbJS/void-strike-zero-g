// Phone HUD top bar: a slim see-through band with health, armor and fuel on the left, the match
// (clock and place, or the team score) in the middle and the sound / achievements buttons on the right.

import React from 'react';
import { ITEM_ICON } from '../hudIcons';
import { HudButtons, InviteToggle } from '../Achievements';
import { useFullscreen } from '../../fullscreen';
import type { Translate } from '../../menu/types';

export type TopBarMatch =
    | { kind: 'solo'; place: number; of: number }
    | { kind: 'team'; blue: number; red: number };

interface Props {
    t: Translate;
    hp: number;
    armor: number;
    fuelPercent: number;
    clock?: string;
    match: TopBarMatch | null;
    muted: boolean;
    onToggleMute: () => void;
    onOpenAchievements: () => void;
    invite?: InviteToggle;
}

const Bar: React.FC<{ percent: number; color: string; width: number; height: number }> = ({ percent, color, width, height }) => (
    <div aria-hidden="true" className="bg-bay-plate/85" style={{ width, height }}>
        <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height, background: color }} />
    </div>
);

const Stat: React.FC<{ icon: string; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
    <div className="flex items-center gap-1">
        <img src={icon} alt={label} className="h-3 w-3 object-contain" />
        {children}
    </div>
);

/** Back into full screen after the browser left it (a swipe, the back gesture), or out of it. */
const FullscreenButton: React.FC<{ t: Translate }> = ({ t }) => {
    const fullscreen = useFullscreen();
    if (!fullscreen.supported) return null;
    return (
        <button type="button" onClick={() => void fullscreen.toggle()} aria-pressed={fullscreen.active}
            aria-label={t(fullscreen.active ? 'hud.exitFullscreen' : 'hud.fullscreen')}
            className="pointer-events-auto flex h-7 w-8 items-center justify-center text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={fullscreen.active ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
            </svg>
        </button>
    );
};

const MatchInfo: React.FC<{ t: Translate; clock?: string; match: TopBarMatch | null }> = ({ t, clock, match }) => (
    <div className="flex flex-1 items-baseline justify-center gap-2">
        {match?.kind === 'team' && <span className="font-display text-[15px] font-black leading-none text-blue-300">{match.blue}</span>}
        {clock && <span className="font-display text-base font-black leading-none text-bay-hazard">{clock}</span>}
        {match?.kind === 'team' && <span className="font-display text-[15px] font-black leading-none text-red-300">{match.red}</span>}
        {match?.kind === 'solo' && <span className="font-display text-[13px] font-extrabold leading-none">{t('hud.place', match.place, match.of)}</span>}
    </div>
);

export const MobileTopBar: React.FC<Props> = ({ t, hp, armor, fuelPercent, clock, match, muted, onToggleMute, onOpenAchievements, invite }) => {
    const low = hp <= 25;
    return (
        <>
            <div className="absolute inset-x-0 top-0 z-40 flex h-7 items-center gap-3 bg-bay-deep/55 pl-3 pr-0.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
                <Stat icon={ITEM_ICON.health} label={t('hud.health')}>
                    <span className={`w-5 font-display text-[15px] font-black leading-none ${low ? 'text-bay-signal' : ''}`}>{Math.max(0, hp)}</span>
                    <Bar percent={hp} color={low ? '#FF4D2E' : '#ECE9E2'} width={56} height={4} />
                </Stat>
                <Stat icon={ITEM_ICON.armor} label={t('hud.armor')}>
                    <span className="font-display text-[13px] font-black leading-none text-blue-300">{Math.round(armor)}</span>
                    <Bar percent={armor} color="#60A5FA" width={32} height={3} />
                </Stat>
                <Stat icon={ITEM_ICON.fuel} label={t('hud.fuel')}>
                    <Bar percent={fuelPercent} color="#FFC21A" width={36} height={3} />
                </Stat>
                <MatchInfo t={t} clock={clock} match={match} />
                <FullscreenButton t={t} />
                <HudButtons t={t} small muted={muted} onToggleMute={onToggleMute} onOpenAchievements={onOpenAchievements} invite={invite} />
            </div>
            <div aria-hidden="true" className="hazard-stripes-xs pointer-events-none absolute inset-x-0 top-7 z-40 h-0.5 opacity-80" />
        </>
    );
};
