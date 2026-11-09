import React from 'react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AccountProvider } from '../../account/AccountProvider';
import { UIProvider } from '../../store/uiStore';
import CharacterSetup from './CharacterSetup';

vi.mock('./CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

const renderOnSecondPreset = () => {
    render(<UIProvider><AccountProvider api={null}><CharacterSetup onContinue={vi.fn()} onBack={vi.fn()} /></AccountProvider></UIProvider>);
    // The arrows load the preset's exact colours, so every row starts at its original
    fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));
};
const swatch = (row: string, name: string) => within(screen.getByRole('radiogroup', { name: `${row} color` })).getByRole('radio', { name });
const resetButton = (row: string) => screen.queryByRole('button', { name: `Restore original ${row} color` });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
});

describe('CharacterSetup colour reset', () => {
    it('shows a row reset only once its colour differs from the preset', () => {
        renderOnSecondPreset();
        fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
        expect(resetButton('Arms')).not.toBeInTheDocument();

        fireEvent.click(swatch('Arms', 'Purple'));
        expect(resetButton('Arms')).toBeInTheDocument();
        expect(resetButton('Torso')).not.toBeInTheDocument();
    });

    it('puts back just that colour and keeps parts and other colours', () => {
        renderOnSecondPreset();
        fireEvent.click(within(screen.getByRole('group', { name: 'Helmet' })).getByRole('button', { name: 'Robot' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
        fireEvent.click(swatch('Arms', 'Purple'));
        fireEvent.click(swatch('Legs', 'Cyan'));

        fireEvent.click(resetButton('Arms')!);
        // The second base (Female human) has skin-tone arms, which are not one of the swatches
        expect(swatch('Arms', 'Purple')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByLabelText('Arms color: Custom')).toHaveValue('#a56b47');
        expect(resetButton('Arms')).not.toBeInTheDocument();
        expect(swatch('Legs', 'Cyan')).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByRole('tab', { name: 'Head' }));
        expect(within(screen.getByRole('group', { name: 'Helmet' })).getByRole('button', { name: 'Robot' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('resets the visor glow on the Head tab and a custom colour too', () => {
        renderOnSecondPreset();
        fireEvent.change(screen.getByLabelText('Visor glow color: Custom'), { target: { value: '#123456' } });
        fireEvent.click(resetButton('Visor glow')!);
        expect(swatch('Visor glow', 'Ice')).toHaveAttribute('aria-checked', 'true');
    });
});
