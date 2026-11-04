// The HUD in a tournament duel: all seven loadout weapons in the bar, and "Sudden death" instead of a 0:00 clock.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameMode, MapId, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { translations } from '../../i18n/locales';
import { createRoomState } from '../../game/net/roomSetup';
import { duelLoadout } from '../../game/systems/duelRules';
import { MATCH_TIME_LIMIT } from '../../game/systems/matchRound';
import { buildMatchHud } from './matchHud';
import { GameHud } from './GameHud';
import { WeaponBar } from './WeaponBar';
import { base, t } from './hudTestKit';

const slotsOf = (container: HTMLElement) => container.firstElementChild!.children.length;

describe('WeaponBar', () => {
    it('shows all seven weapons of the duel loadout', () => {
        const { container } = render(<WeaponBar inventory={duelLoadout()} active={WeaponType.MACHINE_GUN} />);
        expect(slotsOf(container)).toBe(7);
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('keeps the usual six slots in other modes', () => {
        const { container } = render(<WeaponBar inventory={[WEAPONS_DATA[WeaponType.MACHINE_GUN]]} active={WeaponType.MACHINE_GUN} />);
        expect(slotsOf(container)).toBe(6);
    });
});

describe('sudden death clock', () => {
    const duelAt = (scores: [number, number]) => {
        const state = createRoomState(GameMode.DUEL, MapId.PIT);
        state.players = scores.map((score, i) => ({ id: `p${i}`, name: `P${i}`, score })) as typeof state.players;
        state.matchStartedAt = 0;
        return state;
    };

    it('a tied duel past the time limit is in sudden death', () => {
        expect(buildMatchHud(duelAt([4, 4]), MATCH_TIME_LIMIT + 5000, t)).toMatchObject({ suddenDeath: true, timeLeftSec: 0 });
    });

    it('a running duel and other modes are not', () => {
        expect(buildMatchHud(duelAt([4, 4]), 60_000, t)?.suddenDeath).toBeFalsy();
        const dm = { ...duelAt([4, 4]), mode: GameMode.DEATHMATCH };
        expect(buildMatchHud(dm, MATCH_TIME_LIMIT + 5000, t)?.suddenDeath).toBeFalsy();
    });

    it('the HUD shows "Sudden death" instead of 0:00', () => {
        render(<GameHud {...base({ mode: GameMode.DUEL, match: { timeLeftSec: 0, goal: 'First to 10 kills', result: null, suddenDeath: true } })} />);
        expect(screen.getByText('Sudden death')).toBeInTheDocument();
        expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });

    it('has a Russian label', () => {
        expect(translations.ru['tournament.suddenDeath']).toBe('Внезапная смерть');
    });
});
