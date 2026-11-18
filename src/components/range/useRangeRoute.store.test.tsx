import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { GameMode, NetworkMode } from '../../types';
import { useRangeRoute } from './useRangeRoute';

// The hook wired to the real UI store, the way App uses it.
const useRoute = ({ hash }: { hash: string }) => {
    const { state, actions } = useUIStore();
    useRangeRoute(hash, state.isPlaying, actions);
    return { state, actions };
};
const wrapper = ({ children }: { children: React.ReactNode }) => <UIProvider>{children}</UIProvider>;

describe('useRangeRoute with the real UI store', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/#range');
        vi.spyOn(console, 'log').mockImplementation(() => {}); // the store's reducer logs every startGame
    });
    afterEach(() => {
        window.history.replaceState(null, '', '/');
        vi.restoreAllMocks();
    });

    it('plays the range offline even after a join link set the network mode, and Esc returns to the menu', () => {
        const { result, rerender } = renderHook(useRoute, { wrapper, initialProps: { hash: '' } });
        act(() => result.current.actions.setNetworkState(NetworkMode.CLIENT, 'some-game'));
        expect(result.current.state.networkMode).toBe(NetworkMode.CLIENT);

        rerender({ hash: '#range' });
        expect(result.current.state).toMatchObject({
            isPlaying: true, selectedMode: GameMode.RANGE, networkMode: NetworkMode.OFFLINE, gameId: null,
        });

        act(() => result.current.actions.finishGame(0)); // Esc in the match
        expect(result.current.state.isPlaying).toBe(false);
        expect(window.location.hash).toBe('');
    });
});
