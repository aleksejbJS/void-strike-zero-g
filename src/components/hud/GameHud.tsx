// In-game HUD ("Hazard Bay" design): lays out every HUD piece over the game canvas.

import React from 'react';
import { GameMode, KillMessage, Weapon, WeaponType } from '../../types';
import type { PlayerScore, StatsState } from '../../store/uiStore';
import { Achievement } from '../../game/systems/achievements';
import { GUN_GAME_KILLS_PER_LEVEL, GUN_GAME_LADDER } from '../../constants';
import { Vitals } from './Vitals';
import { WeaponBar, AmmoPanel } from './WeaponBar';
import { Scoreboard, TeamScore, KillFeed } from './ScoreHud';
import { HudButtons, AchievementToast, AchievementsPanel } from './Achievements';
import { HungerHud, HungerHudState, GunGameHud, GunGameStatus } from './ModeHud';
import { DeathOverlay, ConnectionOverlay, InviteBanner, DebugStats } from './Overlays';
import { MobileControls, Joystick } from './MobileControls';
import { formatClock } from './format';
import { MatchResult } from './MatchResult';
import type { MatchHud } from './matchHud';
import type { Translate } from '../menu/types';

export interface GameHudProps {
    t: Translate;
    mode: GameMode;
    stats: StatsState;
    scores: { red: number; blue: number };
    inventory: Weapon[];
    activeWeapon: WeaponType | null;
    killFeed: KillMessage[];
    playerScores: PlayerScore[];
    muted: boolean;
    onToggleMute: () => void;
    objective: string | null;
    match: MatchHud | null;
    onLeave: () => void;
    connection: { visible: boolean; error: string | null };
    debug: { fps: number; tps: number } | null;
    inviteLink: string | null;
    recentAchievement: Achievement | null;
    achievementsOpen: boolean;
    onAchievementsOpen: () => void;
    onAchievementsClose: () => void;
    hunger: HungerHudState | null;
    gunGame: { status: GunGameStatus | null; winner: string | null } | null;
    mobile: { joystick: Joystick | null; jumpDown: boolean; hookDown: boolean; onJump: (down: boolean) => void; onHook: (down: boolean) => void } | null;
}

const isTeamMode = (mode: GameMode) => mode === GameMode.CTF || mode === GameMode.HOLD_THE_FLAG || mode === GameMode.INFILTRATION;

export const GameHud: React.FC<GameHudProps> = p => {
    const { t, mode, stats } = p;
    const activeWeapon = p.inventory.find(w => w.type === p.activeWeapon);
    const clock = p.match?.timeLeftSec != null ? formatClock(p.match.timeLeftSec) : undefined;

    return (
        <div className="font-body text-bay-chalk">
            {!isTeamMode(mode) && p.playerScores.length > 0 && (
                <Scoreboard t={t} players={p.playerScores} clock={clock} goal={p.match?.goal}
                    gunLadder={mode === GameMode.GUN_GAME ? { total: GUN_GAME_LADDER.length, perLevel: GUN_GAME_KILLS_PER_LEVEL } : undefined} />
            )}
            {isTeamMode(mode) && <TeamScore t={t} blue={p.scores.blue} red={p.scores.red} objective={p.objective} timer={clock} goal={p.match?.goal} />}
            {mode === GameMode.HUNGER_GAMES && p.hunger && <HungerHud t={t} s={p.hunger} ranking={p.playerScores} />}
            {mode === GameMode.GUN_GAME && p.gunGame && <GunGameHud t={t} status={p.gunGame.status} winner={p.gunGame.winner} />}

            <div className="absolute right-8 top-7 z-50 flex flex-col items-end gap-2.5">
                <HudButtons t={t} muted={p.muted} onToggleMute={p.onToggleMute} onOpenAchievements={p.onAchievementsOpen} />
                <KillFeed kills={p.killFeed} />
                {p.recentAchievement && <AchievementToast t={t} achievement={p.recentAchievement} />}
            </div>

            <Vitals t={t} hp={stats.hp} armor={stats.arm} fuel={stats.fuel} maxFuel={stats.maxFuel ?? 100} />
            <WeaponBar inventory={p.inventory} active={p.activeWeapon} />
            <AmmoPanel weapon={activeWeapon} ammo={stats.ammo} />

            {p.inviteLink && <InviteBanner t={t} link={p.inviteLink} />}
            {p.debug && <DebugStats fps={p.debug.fps} tps={p.debug.tps} />}
            {p.mobile && <MobileControls t={t} {...p.mobile} />}
            {stats.dead && mode !== GameMode.HUNGER_GAMES && <DeathOverlay t={t} respawnMs={stats.respawn} />}
            {p.connection.visible && <ConnectionOverlay t={t} error={p.connection.error} />}
            {p.match?.result && <MatchResult t={t} result={p.match.result} ranking={p.playerScores} onLeave={p.onLeave} />}
            {p.achievementsOpen && <AchievementsPanel t={t} onClose={p.onAchievementsClose} />}
        </div>
    );
};
