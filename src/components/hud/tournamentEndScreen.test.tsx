// The end screen and connection hint in a tournament duel point back to the bracket; other matches are unchanged.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { translations } from '../../i18n/locales';
import { GameHud } from './GameHud';
import { base } from './hudTestKit';

const match = { timeLeftSec: null, goal: 'First to 10 kills', result: { title: 'Alex wins', reason: 'Score limit reached', restartSec: 7, teams: null } };

describe('end screen', () => {
    it('in a tournament: counts down to the bracket and its button goes there', () => {
        const onLeave = vi.fn();
        render(<GameHud {...base({ onLeave, match, tournament: { backInSec: 6 } })} />);
        expect(screen.getByText('Back to bracket in 6 s')).toBeInTheDocument();
        expect(screen.queryByText('Next match in 7s')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back to bracket' }));
        expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('elsewhere: unchanged, next match and back to menu', () => {
        render(<GameHud {...base({ match })} />);
        expect(screen.getByText('Next match in 7s')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument();
        expect(screen.queryByText(/bracket/i)).not.toBeInTheDocument();
    });

    it('has Russian strings', () => {
        expect(translations.ru['tournament.end.backIn']).toBe('Назад к сетке через {0} с');
        expect(translations.ru['tournament.end.toBracket']).toBe('К сетке');
        expect(translations.ru['tournament.net.backToBracket']).toBe('Нажмите Esc, чтобы вернуться к сетке');
    });
});

describe('connection hint', () => {
    it('in a tournament: Esc returns to the bracket', () => {
        render(<GameHud {...base({ connection: { visible: true, error: 'Connection lost' }, tournament: { backInSec: 8 } })} />);
        expect(screen.getByText('Press Esc to return to the bracket')).toBeInTheDocument();
    });

    it('elsewhere: Esc returns to the menu', () => {
        render(<GameHud {...base({ connection: { visible: true, error: 'Connection lost' } })} />);
        expect(screen.getByText('Press Esc to return to the menu')).toBeInTheDocument();
    });
});
