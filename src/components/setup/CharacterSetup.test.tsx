import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { NetworkMode } from '../../types';
import { SKINS } from '../../constants';
import CharacterSetup from './CharacterSetup';

// Pixi needs WebGL, which jsdom lacks; the preview has its own manual check
vi.mock('./CharacterPreview', () => ({ CharacterPreview: ({ badge }: { badge: string }) => <div>{badge}</div> }));

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

const renderSetup = (network = NetworkMode.OFFLINE) => {
    const onContinue = vi.fn();
    const onBack = vi.fn();
    const NetworkInit: React.FC = () => {
        const { actions } = useUIStore();
        React.useEffect(() => actions.setNetworkState(network, null), [actions]);
        return null;
    };
    render(<UIProvider><Spy /><NetworkInit /><CharacterSetup onContinue={onContinue} onBack={onBack} /></UIProvider>);
    return { onContinue, onBack };
};

beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
});

describe('CharacterSetup', () => {
    it('cycles skins and takes the skin palette', () => {
        renderSetup();
        expect(screen.getByText(SKINS[0].name)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Next skin' }));
        expect(screen.getByText(SKINS[1].name)).toBeInTheDocument();
        expect(screen.getByText(`Skin 2 of ${SKINS.length}`)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Previous skin' }));
        fireEvent.click(screen.getByRole('button', { name: 'Previous skin' }));
        expect(screen.getByText(SKINS[SKINS.length - 1].name)).toBeInTheDocument();
    });

    it('counts every click on the skin arrows and applies the new palette', () => {
        renderSetup();
        const next = screen.getByRole('button', { name: 'Next skin' });
        for (let i = 0; i < 3; i++) fireEvent.click(next);
        expect(screen.getByText(SKINS[3].name)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
        expect(store.state.selectedSkin).toBe(SKINS[3].id);
        expect(store.state.torsoColor).toBe(SKINS[3].palette.torso);
    });

    it('saves name, colors and skin, then starts', () => {
        const { onContinue } = renderSetup();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Purple' }));
        fireEvent.change(screen.getByLabelText('Jetpack color: Custom'), { target: { value: '#123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

        expect(onContinue).toHaveBeenCalled();
        expect(store.state.playerName).toBe('Alex');
        expect(store.state.armColor).toBe('#a855f7');
        expect(store.state.jetpackColor).toBe('#123456');
        expect(store.state.isPlaying).toBe(true);
    });

    it('caps the name at 12 characters and counts them', () => {
        renderSetup();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x'.repeat(20) } });
        expect(screen.getByLabelText('Name')).toHaveValue('x'.repeat(12));
        expect(screen.getByText(/12 of 12 characters/)).toBeInTheDocument();
    });

    it('names the start button after what happens next', () => {
        renderSetup(NetworkMode.HOST);
        expect(screen.getByRole('button', { name: 'Create game' })).toBeInTheDocument();
    });

    it('goes back without starting', () => {
        const { onBack } = renderSetup();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(onBack).toHaveBeenCalled();
        expect(store.state.isPlaying).toBe(false);
    });
});
