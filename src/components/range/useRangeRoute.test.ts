import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GameMode, NetworkMode } from '../../types';
import { RANGE_HASH, useRangeRoute } from './useRangeRoute';

const makeActions = () => ({ startGame: vi.fn(), setNetworkState: vi.fn() });

describe('useRangeRoute', () => {
    beforeEach(() => { window.history.replaceState(null, '', '/play?lang=en#range'); });
    afterEach(() => { window.history.replaceState(null, '', '/'); });

    const mount = (hash: string, isPlaying = false) => {
        const actions = makeActions();
        const view = renderHook((p: { hash: string; isPlaying: boolean }) => useRangeRoute(p.hash, p.isPlaying, actions), {
            initialProps: { hash, isPlaying },
        });
        return { actions, ...view };
    };

    it('uses the #range hash', () => {
        expect(RANGE_HASH).toBe('#range');
    });

    it('starts the range once when the hash is #range and nothing is playing', () => {
        const { actions, rerender } = mount('#range');
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        expect(actions.startGame).toHaveBeenCalledWith(GameMode.RANGE);

        rerender({ hash: '#range', isPlaying: false }); // the same hash on a re-render
        rerender({ hash: '#range', isPlaying: true });  // the game is up
        expect(actions.startGame).toHaveBeenCalledTimes(1);
    });

    it('starts the range offline, before the game starts', () => {
        const { actions } = mount('#range');
        expect(actions.setNetworkState).toHaveBeenCalledWith(NetworkMode.OFFLINE, null);
        expect(actions.setNetworkState.mock.invocationCallOrder[0]).toBeLessThan(actions.startGame.mock.invocationCallOrder[0]);
    });

    it('does nothing for other hashes or none', () => {
        const none = mount('');
        const other = mount('#ads-admin');
        expect(none.actions.startGame).not.toHaveBeenCalled();
        expect(other.actions.startGame).not.toHaveBeenCalled();
        expect(none.actions.setNetworkState).not.toHaveBeenCalled();
    });

    it('does not interrupt a match that is already running', () => {
        const { actions } = mount('#range', true);
        expect(actions.startGame).not.toHaveBeenCalled();
    });

    it('survives the double effect run of StrictMode: one start, the hash stays until the game ends', () => {
        const actions = makeActions();
        renderHook(() => useRangeRoute('#range', false, actions), { reactStrictMode: true });
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        expect(window.location.hash).toBe('#range');
    });

    it('drops the hash when the game ends, so the menu does not bounce back into the range', () => {
        const { actions, rerender } = mount('#range');
        rerender({ hash: '#range', isPlaying: true });
        expect(window.location.hash).toBe('#range'); // kept while playing

        rerender({ hash: '#range', isPlaying: false }); // Esc: back to the menu
        expect(window.location.hash).toBe('');
        expect(window.location.pathname).toBe('/play');
        expect(window.location.search).toBe('?lang=en');
        expect(actions.startGame).toHaveBeenCalledTimes(1);
    });

    it('tells hash listeners about the dropped hash, so a later #range is seen as a change', () => {
        const onChange = vi.fn(() => window.location.hash);
        window.addEventListener('hashchange', onChange);
        const { rerender } = mount('#range');
        rerender({ hash: '#range', isPlaying: true });
        rerender({ hash: '#range', isPlaying: false });
        window.removeEventListener('hashchange', onChange);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveReturnedWith('');
    });

    it('opens the range again when #range is typed in after the first visit', () => {
        const { actions, rerender } = mount('#range');
        rerender({ hash: '#range', isPlaying: true });
        rerender({ hash: '#range', isPlaying: false });
        rerender({ hash: '', isPlaying: false });       // the listener reported the dropped hash
        rerender({ hash: '#range', isPlaying: false });
        expect(actions.startGame).toHaveBeenCalledTimes(2);
    });

    it('also drops #range when a match that was already running ends, rather than starting the range', () => {
        const { actions, rerender } = mount('#range', true);
        rerender({ hash: '#range', isPlaying: false });
        expect(actions.startGame).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('');
    });
});
