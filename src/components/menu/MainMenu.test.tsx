import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { NetworkMode, MapId } from '../../types';
import MainMenu from './MainMenu';

// Exposes store state to assertions
let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

const renderMenu = (onCustomize = vi.fn()) => {
    render(<UIProvider><Spy /><MainMenu onCustomize={onCustomize} /></UIProvider>);
    return onCustomize;
};

beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
});

describe('MainMenu', () => {
    it('shows the selected mode with its preview and three rules', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: /Capture the Flag/ }));
        expect(screen.getByRole('heading', { level: 2, name: 'Capture the Flag' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'How Capture the Flag plays' })).toBeInTheDocument();
        expect(screen.getByText('If the carrier dies, the flag goes back to its base')).toBeInTheDocument();
    });

    it('offers only the maps a mode supports', () => {
        renderMenu();
        const mapGroup = () => within(screen.getByRole('group', { name: 'Map' }));
        fireEvent.click(screen.getByRole('button', { name: /^Deathmatch/ }));
        expect(mapGroup().getAllByRole('button').map(b => b.textContent)).toEqual(['Default', 'Tunnels']);

        fireEvent.click(screen.getByRole('button', { name: /Hunger Games/ }));
        expect(mapGroup().getAllByRole('button').map(b => b.textContent)).toEqual(['Hunger arena']);
        expect(store.state.selectedMap).toBe(MapId.HUNGER);

        fireEvent.click(screen.getByRole('button', { name: /Infiltration/ }));
        expect(mapGroup().getAllByRole('button').map(b => b.textContent)).toEqual(['Default']);
        expect(store.state.selectedMap).toBe(MapId.DEFAULT);
    });

    it('Play vs bots starts an offline game in the chosen mode', () => {
        const onCustomize = renderMenu();
        fireEvent.click(screen.getByRole('button', { name: /Gun Game/ }));
        fireEvent.click(screen.getByRole('button', { name: /Play vs bots/ }));
        expect(onCustomize).toHaveBeenCalled();
        expect(store.state.networkMode).toBe(NetworkMode.OFFLINE);
        expect(store.state.selectedMode).toBe('GUN_GAME');
    });

    it('Create game hosts, Join uses the pasted invite', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Create game and get a link' }));
        expect(store.state.networkMode).toBe(NetworkMode.HOST);

        fireEvent.change(screen.getByLabelText('Got an invite? Paste it here'), { target: { value: ' http://x/?host=abc ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Join' }));
        expect(store.state.networkMode).toBe(NetworkMode.CLIENT);
        expect(store.state.gameId).toBe('http://x/?host=abc');
    });

    it("opens and closes What's new", () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: "What's new" }));
        expect(screen.getByRole('dialog', { name: "What's new" })).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('switches to Russian', () => {
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Switch language to Russian' }));
        expect(screen.getByRole('button', { name: /Играть с ботами/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Бой насмерть' })).toBeInTheDocument();
    });
});
