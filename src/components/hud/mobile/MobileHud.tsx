// Phone HUD (spec 2026-11-03-mobile-hud): slim top bar, small kill feed, weapon row above the aim
// stick, the two sticks and the hook. Stands in for the desktop scoreboard, vitals, weapon bar
// and ammo box; the mode panels and full-screen overlays are shared with the desktop HUD.

import React from 'react';
import { KillMessage, Weapon, WeaponType } from '../../../types';
import type { PlayerScore, StatsState } from '../../../store/uiStore';
import type { TouchSticksState } from '../../../game/input/touchSticks';
import { Achievement } from '../../../game/systems/achievements';
import { weaponLabel } from '../weaponLabel';
import { AchievementToast, InviteToggle } from '../Achievements';
import { MobileTopBar, TopBarMatch } from './MobileTopBar';
import { MobileWeapons } from './MobileWeapons';
import { TouchSticks } from './TouchSticks';
import { TouchHint } from './TouchHint';
import type { Translate } from '../../menu/types';

export interface MobileControls {
    sticks: TouchSticksState;
    hookDown: boolean;
    onHook: (down: boolean) => void;
    onSelectWeapon: (index: number) => void;
}

interface Props {
    t: Translate;
    teamMode: boolean;
    stats: StatsState;
    scores: { red: number; blue: number };
    clock?: string;
    objective: string | null;
    playerScores: PlayerScore[];
    inventory: Weapon[];
    activeWeapon: WeaponType | null;
    killFeed: KillMessage[];
    recentAchievement: Achievement | null;
    muted: boolean;
    onToggleMute: () => void;
    onOpenAchievements: () => void;
    invite?: InviteToggle;
    controls: MobileControls;
}

const matchOf = (teamMode: boolean, scores: Props['scores'], players: PlayerScore[]): TopBarMatch | null => {
    if (teamMode) return { kind: 'team', blue: scores.blue, red: scores.red };
    const place = players.findIndex(p => p.isLocal) + 1;
    return place > 0 ? { kind: 'solo', place, of: players.length } : null;
};

const KillFeed: React.FC<{ t: Translate; kills: KillMessage[] }> = ({ t, kills }) => (
    <div className="pointer-events-none absolute right-3 top-9 z-40 flex flex-col items-end gap-0.5 text-[10px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        {kills.slice(-3).map(k => (
            <span key={k.id}>
                <b style={{ color: k.killerColor }}>{k.killer}</b>{' '}
                <span className="text-bay-dust">{weaponLabel(t, k.weapon).toLowerCase()}</span>{' '}
                <b style={{ color: k.victimColor }}>{k.victim}</b>
            </span>
        ))}
    </div>
);

export const MobileHud: React.FC<Props> = p => {
    const { t, stats, controls } = p;
    const fuelPercent = Math.round((stats.fuel / (stats.maxFuel || 100)) * 100);
    return (
        <>
            <MobileTopBar t={t} hp={stats.hp} armor={stats.arm} fuelPercent={fuelPercent} bleeding={stats.bleeding} clock={p.clock}
                match={matchOf(p.teamMode, p.scores, p.playerScores)}
                muted={p.muted} onToggleMute={p.onToggleMute} onOpenAchievements={p.onOpenAchievements} invite={p.invite} />
            {p.objective && (
                <span className="pointer-events-none absolute left-1/2 top-9 z-40 -translate-x-1/2 text-[11px] text-bay-chalk [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">{p.objective}</span>
            )}
            <KillFeed t={t} kills={p.killFeed} />
            {p.recentAchievement && (
                <div className="absolute right-3 top-[88px] z-40 origin-top-right scale-75">
                    <AchievementToast t={t} achievement={p.recentAchievement} />
                </div>
            )}
            <MobileWeapons t={t} inventory={p.inventory} active={p.activeWeapon} ammo={stats.ammo} reload={stats.reload} onSelect={controls.onSelectWeapon} />
            <TouchSticks t={t} sticks={controls.sticks} hookDown={controls.hookDown} onHook={controls.onHook} />
            <TouchHint t={t} />
        </>
    );
};
