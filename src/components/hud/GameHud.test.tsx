import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameMode, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { translations } from '../../i18n/locales';
import { GameHud, GameHudProps } from './GameHud';

const t = ((key: keyof typeof translations.en, ...args: unknown[]) =>
    translations.en[key].replace(/{(\d+)}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m))) as GameHudProps['t'];

const base = (over: Partial<GameHudProps> = {}): GameHudProps => ({
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
    mobile: null,
    ...over,
});

describe('GameHud', () => {
    it('shows vitals, weapons and ammo', () => {
        render(<GameHud {...base()} />);
        expect(screen.getByText('82')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument(); // 75 of a 150 tank
        expect(screen.getByRole('img', { name: 'Shotgun' })).toBeInTheDocument();
        expect(screen.getByText('994')).toBeInTheDocument();
    });

    it('marks only the local player on the scoreboard', () => {
        render(<GameHud {...base()} />);
        expect(screen.getByText('Alex (you)')).toBeInTheDocument();
        expect(screen.queryByText('Bot 1 (you)')).not.toBeInTheDocument();
    });

    it('team modes show the score, objective, match clock and goal', () => {
        render(<GameHud {...base({ mode: GameMode.CTF, objective: 'Grab the red flag from their base.', match: { timeLeftSec: 161, goal: 'First to 3 captures', result: null } })} />);
        expect(screen.getByText('Grab the red flag from their base.')).toBeInTheDocument();
        expect(screen.getByText('2:41')).toBeInTheDocument();
        expect(screen.getByText('First to 3 captures')).toBeInTheDocument();
        expect(screen.queryByText('Scoreboard')).not.toBeInTheDocument();
    });

    it('shows the results screen and lets you leave', () => {
        const onLeave = vi.fn();
        render(<GameHud {...base({ onLeave, match: { timeLeftSec: null, goal: 'First to 20 kills', result: { title: 'Alex wins', reason: 'Score limit reached', restartSec: 7, teams: null } } })} />);
        expect(screen.getByRole('dialog', { name: 'Alex wins' })).toBeInTheDocument();
        expect(screen.getByText('Next match in 7s')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
        expect(onLeave).toHaveBeenCalled();
    });

    it('shows the death screen with a countdown', () => {
        render(<GameHud {...base({ stats: { ...base().stats, dead: true, respawn: 1500 } })} />);
        expect(screen.getByText('You died')).toBeInTheDocument();
        expect(screen.getByText('Back in 1.5s')).toBeInTheDocument();
    });

    it('sound and achievements buttons call back', () => {
        const props = base();
        render(<GameHud {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sound on or off' }));
        fireEvent.click(screen.getByRole('button', { name: 'Achievements' }));
        expect(props.onToggleMute).toHaveBeenCalled();
        expect(props.onAchievementsOpen).toHaveBeenCalled();
    });

    it('Hunger Games: bet on a survivor after dying', () => {
        const onBet = vi.fn();
        render(<GameHud {...base({ mode: GameMode.HUNGER_GAMES, hunger: {
            credits: 100, betTarget: null, winner: null, ended: false, timeUp: false, timeLeftSec: 192, shrinkSec: null,
            restartSec: null, fightInSec: null, winnerId: null, localDead: true, alive: [{ id: 'b2', name: 'Bot 2' }], onBet,
        } })} />);
        expect(screen.getByText('Round ends in 3:12')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Bot 2' }));
        expect(onBet).toHaveBeenCalledWith('b2');
    });
});
