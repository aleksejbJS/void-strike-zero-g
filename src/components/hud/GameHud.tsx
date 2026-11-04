// In-game HUD ("Hazard Bay" design): lays out every HUD piece over the game canvas.

import React, { useState } from 'react';
import { GameMode, KillMessage, Weapon, WeaponType } from '../../types';
import type { PlayerScore, StatsState } from '../../store/uiStore';
import type { Reward } from '../../game/build/progress';
import { Achievement } from '../../game/systems/achievements';
import { GUN_GAME_KILLS_PER_LEVEL, GUN_GAME_LADDER } from '../../constants';
import { Vitals } from './Vitals';
import { WeaponBar, AmmoPanel } from './WeaponBar';
import { Scoreboard, TeamScore, KillFeed } from './ScoreHud';
import { HudButtons, AchievementToast, AchievementsPanel, InviteToggle } from './Achievements';
import { HungerHud, HungerHudState, GunGameHud, GunGameStatus } from './ModeHud';
import { DeathOverlay, ConnectionOverlay, ForfeitHint, InviteBanner, DebugStats } from './Overlays';
import { MobileHud, MobileControls } from './mobile/MobileHud';
import { formatClock } from './format';
import { MatchResult } from './MatchResult';
import { FlagBanner } from './FlagBanner';
import type { FlagBannerEvent } from './flagBannerText';
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
    flagBanner: FlagBannerEvent | null; // last objective change, shown as a fading banner
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
    reward: Reward | null; // XP for the match that just ended; null while play goes on
    mobile: MobileControls | null; // touch device: the phone HUD and twin sticks instead of the desktop pieces
    /** A tournament duel: Esc and the end screen lead back to the bracket; Esc twice forfeits; a guest reconnects. */
    tournament?: { backInSec: number; forfeitArmed?: boolean; reconnecting?: boolean } | null;
}

const isTeamMode = (mode: GameMode) => mode === GameMode.CTF || mode === GameMode.HOLD_THE_FLAG || mode === GameMode.INFILTRATION;

export const GameHud: React.FC<GameHudProps> = p => {
    const { t, mode, stats } = p;
    const [inviteOpen, setInviteOpen] = useState(true);
    const invite: InviteToggle | undefined = p.inviteLink ? { open: inviteOpen, onToggle: () => setInviteOpen(o => !o) } : undefined;
    const activeWeapon = p.inventory.find(w => w.type === p.activeWeapon);
    const clock = p.match?.suddenDeath ? t('tournament.suddenDeath')
        : p.match?.timeLeftSec != null ? formatClock(p.match.timeLeftSec) : undefined;

    return (
        <div className="font-body text-bay-chalk">
            {p.mobile ? (
                <MobileHud t={t} teamMode={isTeamMode(mode)} stats={stats} scores={p.scores} clock={clock} objective={p.objective}
                    playerScores={p.playerScores} inventory={p.inventory} activeWeapon={p.activeWeapon} killFeed={p.killFeed}
                    recentAchievement={p.recentAchievement} muted={p.muted} onToggleMute={p.onToggleMute}
                    onOpenAchievements={p.onAchievementsOpen} invite={invite} controls={p.mobile} />
            ) : (
                <DesktopHud {...p} clock={clock} activeWeaponData={activeWeapon} invite={invite} />
            )}
            {isTeamMode(mode) && <FlagBanner t={t} banner={p.flagBanner} />}
            {mode === GameMode.HUNGER_GAMES && p.hunger && <HungerHud t={t} s={p.hunger} ranking={p.playerScores} reward={p.reward} />}
            {mode === GameMode.GUN_GAME && p.gunGame && <GunGameHud t={t} status={p.gunGame.status} winner={p.gunGame.winner} reward={p.reward} />}

            {p.inviteLink && inviteOpen && <InviteBanner t={t} link={p.inviteLink} onClose={() => setInviteOpen(false)} />}
            {p.debug && <DebugStats fps={p.debug.fps} tps={p.debug.tps} />}
            {stats.dead && mode !== GameMode.HUNGER_GAMES && <DeathOverlay t={t} respawnMs={stats.respawn} />}
            {p.connection.visible && <ConnectionOverlay t={t} error={p.connection.error} inTournament={!!p.tournament} reconnecting={!!p.tournament?.reconnecting} />}
            {p.tournament?.forfeitArmed && <ForfeitHint t={t} />}
            {p.match?.result && <MatchResult t={t} result={p.match.result} ranking={p.playerScores} reward={p.reward} onLeave={p.onLeave} tournament={p.tournament} />}
            {p.achievementsOpen && <AchievementsPanel t={t} onClose={p.onAchievementsClose} />}
        </div>
    );
};

/** Desktop pieces: scoreboard or team score, buttons and kill feed, vitals, weapon slots, ammo. */
const DesktopHud: React.FC<GameHudProps & { clock?: string; activeWeaponData?: Weapon; invite?: InviteToggle }> = p => {
    const { t, mode, stats, clock } = p;
    return (
        <>
            {!isTeamMode(mode) && p.playerScores.length > 0 && (
                <Scoreboard t={t} players={p.playerScores} clock={clock} goal={p.match?.goal}
                    gunLadder={mode === GameMode.GUN_GAME ? { total: GUN_GAME_LADDER.length, perLevel: GUN_GAME_KILLS_PER_LEVEL } : undefined} />
            )}
            {isTeamMode(mode) && <TeamScore t={t} blue={p.scores.blue} red={p.scores.red} objective={p.objective} timer={clock} goal={p.match?.goal} />}

            <div className="absolute right-8 top-7 z-50 flex flex-col items-end gap-2.5">
                <HudButtons t={t} muted={p.muted} onToggleMute={p.onToggleMute} onOpenAchievements={p.onAchievementsOpen} invite={p.invite} />
                <KillFeed t={t} kills={p.killFeed} />
                {p.recentAchievement && <AchievementToast t={t} achievement={p.recentAchievement} />}
            </div>

            <Vitals t={t} hp={stats.hp} armor={stats.arm} fuel={stats.fuel} maxFuel={stats.maxFuel ?? 100} bleeding={stats.bleeding} />
            <WeaponBar inventory={p.inventory} active={p.activeWeapon} />
            <AmmoPanel t={t} weapon={p.activeWeaponData} ammo={stats.ammo} />
        </>
    );
};
