// The duel HUD's two tournament overlays: "Press Esc again to forfeit" and "Reconnecting…".

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { translations } from '../../i18n/locales';
import { GameHud } from './GameHud';
import { base } from './hudTestKit';

describe('tournament duel HUD', () => {
    it('shows the forfeit hint after the first Esc only', () => {
        const { rerender } = render(<GameHud {...base({ tournament: { backInSec: 8, forfeitArmed: true } })} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Press Esc again to forfeit the match');
        rerender(<GameHud {...base({ tournament: { backInSec: 8, forfeitArmed: false } })} />);
        expect(screen.queryByText('Press Esc again to forfeit the match')).not.toBeInTheDocument();
    });

    it('while the guest dials the host again, the connection overlay says Reconnecting', () => {
        render(<GameHud {...base({ connection: { visible: true, error: null }, tournament: { backInSec: 8, reconnecting: true } })} />);
        expect(screen.getByRole('status')).toHaveTextContent('Connection lost. Reconnecting…');
    });

    it('has Russian strings', () => {
        expect(translations.ru['tournament.match.forfeitHint']).toBe('Нажмите Esc ещё раз, чтобы сдать матч');
        expect(translations.ru['tournament.match.reconnecting']).toBe('Связь потеряна. Переподключаемся…');
    });
});
