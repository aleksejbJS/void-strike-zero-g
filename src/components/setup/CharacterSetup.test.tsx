import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AccountProvider } from '../../account/AccountProvider';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { NetworkMode } from '../../types';
import { BODY_PRESETS } from '../../game/build/characterBases';
import CharacterSetup from './CharacterSetup';

// Pixi needs WebGL, which jsdom lacks; the preview has its own manual check
vi.mock('./CharacterPreview', () => ({ CharacterPreview: ({ badge }: { badge: string }) => <div>{badge}</div> }));
// Tile pictures are drawn by Pixi too; without them the tiles show names only
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

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
    // api={null}: accounts are off, so this is the plain screen
    render(<UIProvider><AccountProvider api={null}><Spy /><NetworkInit /><CharacterSetup onContinue={onContinue} onBack={onBack} /></AccountProvider></UIProvider>);
    return { onContinue, onBack };
};

const getItem = localStorage.getItem as ReturnType<typeof vi.fn>;
const setItem = localStorage.setItem as ReturnType<typeof vi.fn>;
const withXp = (xp: number) => getItem.mockImplementation((key: string) => (key === 'fighterXp' ? String(xp) : null));
const slot = (name: string) => screen.getByRole('group', { name });
const savedBuild = () => {
    const call = setItem.mock.calls.filter(([key]) => key === 'fighterBuild').pop();
    return call ? JSON.parse(call[1] as string) : null;
};

beforeEach(() => {
    getItem.mockReset();
    getItem.mockReturnValue(null);
    setItem.mockClear();
});

describe('CharacterSetup', () => {
    it('cycles presets', () => {
        renderSetup();
        expect(screen.getByText('Human')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));
        expect(screen.getByText('Female human')).toBeInTheDocument();
        expect(screen.getByText('Preset 2 of 5')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Previous preset' }));
        fireEvent.click(screen.getByRole('button', { name: 'Previous preset' }));
        expect(screen.getByText('Preset 5 of 5')).toBeInTheDocument();
    });

    it('counts every click on the preset arrows and applies the new palette', () => {
        renderSetup();
        const next = screen.getByRole('button', { name: 'Next preset' });
        for (let i = 0; i < 3; i++) fireEvent.click(next);
        expect(screen.getByText('Toxic')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
        expect(store.state.selectedSkin).toBe('base-toxic');
        expect(store.state.torsoColor).toBe(BODY_PRESETS[3].palette.torso);
    });

    it('shows four tabs and the head slots by default', () => {
        renderSetup();
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map(tab => tab.textContent)).toEqual(['Head', 'Body', 'Jetpack', 'Colors']);
        expect(screen.getByRole('tab', { name: 'Head' })).toHaveAttribute('aria-selected', 'true');
        expect(slot('Helmet')).toBeInTheDocument();
        expect(slot('Visor')).toBeInTheDocument();
        expect(slot('Ears & horns')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Tail' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Body' }));
        expect(slot('Tail')).toBeInTheDocument();
        expect(slot('Pattern')).toBeInTheDocument();
        expect(slot('Shoulder badge')).toBeInTheDocument();
    });

    it('locked tiles are disabled and show their level', () => {
        renderSetup();
        const wolf = within(slot('Ears & horns')).getByRole('button', { name: /Wolf/ });
        expect(wolf).toBeDisabled();
        expect(wolf).toHaveTextContent('Lvl 2');
        expect(within(slot('Ears & horns')).getByRole('button', { name: 'Cat' })).toBeEnabled();
        expect(screen.getByText('Level 1 · 50 XP to the next part')).toBeInTheDocument();
    });

    it('picking a free part updates the build and marks the preset as changed', () => {
        renderSetup();
        expect(screen.queryByText('(changed)')).not.toBeInTheDocument();
        const box = within(slot('Helmet')).getByRole('button', { name: 'Robot' });
        expect(box).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(box);
        expect(box).toHaveAttribute('aria-pressed', 'true');
        expect(within(slot('Helmet')).getByRole('button', { name: 'Round' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('(changed)')).toBeInTheDocument();
    });

    it('the preset arrows replace the whole build and colours', () => {
        renderSetup();
        fireEvent.click(within(slot('Helmet')).getByRole('button', { name: 'Robot' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Arms color' })).getByRole('radio', { name: 'Purple' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));

        expect(screen.getByText('Female human')).toBeInTheDocument();
        expect(screen.queryByText('(changed)')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Arms color: Custom')).toHaveValue('#a56b47');
        fireEvent.click(screen.getByRole('tab', { name: 'Head' }));
        expect(within(slot('Helmet')).getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('Start saves the build', () => {
        const { onContinue } = renderSetup();
        fireEvent.click(within(slot('Ears & horns')).getByRole('button', { name: 'Antennae' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
        expect(savedBuild()).toMatchObject({ body: 'human', helmet: 'none', ears: 'antennae' });
        expect(onContinue).toHaveBeenCalled();
    });

    it('opens a saved build without parts the level has not opened', () => {
        getItem.mockImplementation((key: string) => (key === 'fighterBuild'
            ? JSON.stringify({ helmet: 'dome', ears: 'wolf', visor: 'strip' }) : null));
        renderSetup();
        expect(within(slot('Helmet')).getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(slot('Ears & horns')).getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('the number field appears only for the number badge and keeps 0..99', () => {
        withXp(5000);
        renderSetup();
        fireEvent.click(screen.getByRole('tab', { name: 'Body' }));
        const badges = slot('Shoulder badge');
        expect(screen.queryByLabelText('Badge number')).not.toBeInTheDocument();

        fireEvent.click(within(badges).getByRole('button', { name: 'Number' }));
        const field = screen.getByLabelText('Badge number');
        fireEvent.change(field, { target: { value: '150' } });
        expect(field).toHaveValue(99);
        fireEvent.change(field, { target: { value: '-4' } });
        expect(field).toHaveValue(0);
        fireEvent.change(field, { target: { value: '42' } });
        expect(field).toHaveValue(42);
        expect(screen.queryByRole('radiogroup', { name: 'Emblem' })).not.toBeInTheDocument();

        fireEvent.click(within(badges).getByRole('button', { name: 'Emblem' }));
        expect(screen.queryByLabelText('Badge number')).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Emblem' })).getByRole('radio', { name: 'Star' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
        expect(savedBuild()).toMatchObject({ badge: 'emblem', badgeNumber: 42, emblem: 'star' });
    });

    it('saves name, colors and skin, then starts', () => {
        const { onContinue } = renderSetup();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Arms color' })).getByRole('radio', { name: 'Purple' }));
        fireEvent.change(screen.getByLabelText('Jetpack color: Custom'), { target: { value: '#123456' } });
        fireEvent.change(screen.getByLabelText('Pattern color: Custom'), { target: { value: '#abcdef' } });
        fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

        expect(onContinue).toHaveBeenCalled();
        expect(store.state.playerName).toBe('Alex');
        expect(store.state.armColor).toBe('#a855f7');
        expect(store.state.jetpackColor).toBe('#123456');
        expect(store.state.isPlaying).toBe(true);
        expect(savedBuild()).toMatchObject({ patternColor: '#abcdef' });
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
