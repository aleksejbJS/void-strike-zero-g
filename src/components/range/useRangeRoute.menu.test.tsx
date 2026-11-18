import React, { useEffect, useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { GameMode, MapId } from '../../types';
import MainMenu from '../menu/MainMenu';
import { useRangeRoute } from './useRangeRoute';

// App in miniature: the same hash listener, the same hook call, and the real main menu while nothing is playing.
let store: ReturnType<typeof useUIStore>;
const MiniApp: React.FC = () => {
    store = useUIStore();
    const { state, actions } = store;
    const [hash, setHash] = useState(window.location.hash);
    useEffect(() => {
        const onChange = () => setHash(window.location.hash);
        window.addEventListener('hashchange', onChange);
        return () => window.removeEventListener('hashchange', onChange);
    }, []);
    useRangeRoute(hash, state.isPlaying, state.selectedMode, state.selectedMap, actions);
    if (state.isPlaying) return <div data-testid="game" />;
    return <MainMenu onCustomize={vi.fn()} onOpenProfile={vi.fn()} onOpenLeaderboard={vi.fn()} />;
};

const goTo = (hash: string) => act(() => {
    window.history.replaceState(null, '', '/' + hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
});

describe('the range with the real main menu', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // the store's reducer logs every startGame
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
        render(
            <UIProvider>
                <AccountContext.Provider value={stubAccount({ status: 'disabled' })}><MiniApp /></AccountContext.Provider>
            </UIProvider>,
        );
        act(() => { store.actions.selectMode(GameMode.DEATHMATCH); store.actions.selectMap(MapId.TUNNELS); });
    });
    afterEach(() => {
        window.history.replaceState(null, '', '/');
        logSpy.mockRestore(); // not restoreAllMocks: it would also reset the global ResizeObserver mock
    });

    const expectMenuAsBefore = () => {
        expect(store.state).toMatchObject({ isPlaying: false, selectedMode: GameMode.DEATHMATCH, selectedMap: MapId.TUNNELS });
        expect(window.location.hash).toBe('');
    };

    it('starts from Deathmatch on Tunnels', () => {
        expect(store.state).toMatchObject({ selectedMode: GameMode.DEATHMATCH, selectedMap: MapId.TUNNELS });
    });

    it('Esc returns to Deathmatch on Tunnels', () => {
        goTo('#range');
        expect(store.state).toMatchObject({ isPlaying: true, selectedMode: GameMode.RANGE });

        act(() => store.actions.finishGame(0)); // Esc in the match
        expectMenuAsBefore();
    });

    it('removing the hash ends the range and returns to Deathmatch on Tunnels', () => {
        goTo('#range');
        expect(store.state.isPlaying).toBe(true);

        goTo('');
        expectMenuAsBefore();
    });
});
