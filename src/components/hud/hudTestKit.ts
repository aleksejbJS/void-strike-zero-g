// Shared fixtures for the GameHud tests: an English translator and a complete set of HUD props.

import { vi } from 'vitest';
import { GameMode, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { translations } from '../../i18n/locales';
import type { GameHudProps } from './GameHud';

export const t = ((key: keyof typeof translations.en, ...args: unknown[]) =>
    translations.en[key].replace(/{(\d+)}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m))) as GameHudProps['t'];

export const base = (over: Partial<GameHudProps> = {}): GameHudProps => ({
    t,
    mode: GameMode.DEATHMATCH,
    stats: { hp: 82, arm: 40, fuel: 75, maxFuel: 150, ammo: 994, dead: false, respawn: 0 },
    scores: { red: 1, blue: 2 },
    inventory: [WEAPONS_DATA[WeaponType.MACHINE_GUN], WEAPONS_DATA[WeaponType.SHOTGUN]],
    activeWeapon: WeaponType.MACHINE_GUN,
    killFeed: [{ id: 'k1', killer: 'Bot 3', killerColor: '#f00', weapon: 'Rockets', victim: 'Bot 2', victimColor: '#00f', time: 0 }],
    playerScores: [{ id: 'me', name: 'Alex', score: 3, isPlayer: true, isLocal: true }, { id: 'b', name: 'Bot 1', score: 1, isPlayer: false }],
    muted: false,
    onToggleMute: vi.fn(),
    objective: null,
    flagBanner: null,
    match: null,
    onLeave: vi.fn(),
    connection: { visible: false, error: null },
    debug: null,
    inviteLink: null,
    recentAchievement: null,
    achievementsOpen: false,
    onAchievementsOpen: vi.fn(),
    onAchievementsClose: vi.fn(),
    hunger: null,
    gunGame: null,
    reward: null,
    mobile: null,
    ...over,
});
