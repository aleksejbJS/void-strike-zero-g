import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GameMode, MapId, NetworkMode } from '../../types';
import { RANGE_HASH, useRangeRoute } from './useRangeRoute';
import { afterEsc, inRange, makeActions, mountRoute } from './useRangeRouteTestKit';

describe('useRangeRoute', () => {
    beforeEach(() => { window.history.replaceState(null, '', '/play?lang=en#range'); });
    afterEach(() => { window.history.replaceState(null, '', '/'); });

    const mount = mountRoute;
    const standing = { isPlaying: false, selectedMap: MapId.DEFAULT };

    it('uses the #range hash', () => {
        expect(RANGE_HASH).toBe('#range');
    });

    it('starts the range once when the hash is #range and nothing is playing', () => {
        const { actions, rerender } = mount('#range');
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        expect(actions.startGame).toHaveBeenCalledWith(GameMode.RANGE);

        rerender({ hash: '#range', ...standing, selectedMode: GameMode.GUN_GAME }); // the same hash on a re-render
        rerender(inRange); // the game is up
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
        renderHook(() => useRangeRoute('#range', false, GameMode.GUN_GAME, MapId.DEFAULT, actions), { reactStrictMode: true });
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        expect(window.location.hash).toBe('#range');
    });

    it('drops the hash when the game ends, so the menu does not bounce back into the range', () => {
        const { actions, rerender } = mount('#range');
        rerender(inRange);
        expect(window.location.hash).toBe('#range'); // kept while playing

        rerender(afterEsc); // Esc: back to the menu
        expect(window.location.hash).toBe('');
        expect(window.location.pathname).toBe('/play');
        expect(window.location.search).toBe('?lang=en');
        expect(actions.startGame).toHaveBeenCalledTimes(1);
    });

    it('tells hash listeners about the dropped hash, so a later #range is seen as a change', () => {
        const onChange = vi.fn(() => window.location.hash);
        window.addEventListener('hashchange', onChange);
        const { rerender } = mount('#range');
        rerender(inRange);
        rerender(afterEsc);
        window.removeEventListener('hashchange', onChange);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveReturnedWith('');
    });

    it('opens the range again when #range is typed in after the first visit', () => {
        const { actions, rerender } = mount('#range');
        rerender(inRange);
        rerender(afterEsc);
        rerender({ ...afterEsc, hash: '' }); // the listener reported the dropped hash
        rerender({ hash: '#range', ...standing, selectedMode: GameMode.GUN_GAME });
        expect(actions.startGame).toHaveBeenCalledTimes(2);
    });

    it('also drops #range when a match that was already running ends, rather than starting the range', () => {
        const { actions, rerender } = mount('#range', true);
        rerender({ hash: '#range', ...standing, selectedMode: GameMode.GUN_GAME });
        expect(actions.startGame).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('');
    });

    describe('the mode the menu shows afterwards', () => {
        it('puts back the mode that was selected before the range, when the range ends', () => {
            const { actions, rerender } = mount('#range', false, GameMode.GUN_GAME);
            rerender(inRange);
            expect(actions.selectMode).not.toHaveBeenCalled(); // the range keeps its mode while it runs

            rerender(afterEsc);
            expect(actions.selectMode).toHaveBeenCalledTimes(1);
            expect(actions.selectMode).toHaveBeenCalledWith(GameMode.GUN_GAME);
            expect(window.location.hash).toBe('');
        });

        it.each([GameMode.RANGE, GameMode.DUEL])('falls back to Deathmatch when the previous mode was %s (not a menu mode)', previous => {
            const { actions, rerender } = mount('#range', false, previous);
            rerender(inRange);
            rerender(afterEsc);
            expect(actions.selectMode).toHaveBeenCalledTimes(1);
            expect(actions.selectMode).toHaveBeenCalledWith(GameMode.DEATHMATCH);
        });

        it('remembers the mode from the start of the range, not from when it ends', () => {
            const { actions, rerender } = mount('#range', false, GameMode.CTF);
            rerender({ hash: '#range', ...standing, selectedMode: GameMode.RANGE });
            rerender(inRange);
            rerender(afterEsc);
            expect(actions.selectMode).toHaveBeenCalledWith(GameMode.CTF);
        });

        it('restores it once, and not again on later re-renders', () => {
            const { actions, rerender } = mount('#range', false, GameMode.CTF);
            rerender(inRange);
            rerender(afterEsc);
            rerender({ ...afterEsc, hash: '' });
            rerender({ hash: '', ...standing, selectedMode: GameMode.CTF });
            expect(actions.selectMode).toHaveBeenCalledTimes(1);
        });

        it('restores it when the range ends because the hash was edited away', () => {
            const { actions, rerender } = mount('#range', false, GameMode.HOLD_THE_FLAG);
            rerender(inRange);
            rerender({ ...inRange, hash: '' });
            expect(actions.finishGame).toHaveBeenCalledTimes(1); // the hash ends the range...
            rerender({ hash: '', ...standing, selectedMode: GameMode.RANGE }); // ...and the store reports the match over
            expect(actions.selectMode).toHaveBeenCalledTimes(1);
            expect(actions.selectMode).toHaveBeenCalledWith(GameMode.HOLD_THE_FLAG);
        });

        it('leaves the mode alone when the range was not started by the hash (a match was already running)', () => {
            const { actions, rerender } = mount('#range', true, GameMode.GUN_GAME);
            rerender({ hash: '#range', ...standing, selectedMode: GameMode.GUN_GAME });
            expect(actions.selectMode).not.toHaveBeenCalled();
        });
    });
});
