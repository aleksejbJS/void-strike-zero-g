import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, MapId } from '../../types';
import { afterEsc, inRange, mountRoute } from './useRangeRouteTestKit';

// Spec goal 1: leaving the range, by Esc or by removing the hash, returns to the normal game.
describe('useRangeRoute: leaving the range by removing the hash', () => {
    beforeEach(() => { window.history.replaceState(null, '', '/play#range'); });
    afterEach(() => { window.history.replaceState(null, '', '/'); });

    const hashGone = { ...inRange, hash: '' };

    it('ends the running range without saving a score, once', () => {
        const { actions, rerender } = mountRoute('#range');
        rerender(inRange);
        expect(actions.finishGame).not.toHaveBeenCalled(); // while the hash stays, the range runs on

        rerender(hashGone);
        expect(actions.finishGame).toHaveBeenCalledTimes(1);
        expect(actions.finishGame).toHaveBeenCalledWith(0);
    });

    it('does the same when the hash is replaced by another one', () => {
        const { actions, rerender } = mountRoute('#range');
        rerender(inRange);
        rerender({ ...inRange, hash: '#ads-admin' });
        expect(actions.finishGame).toHaveBeenCalledTimes(1);
        expect(actions.finishGame).toHaveBeenCalledWith(0);
    });

    it('then puts the menu mode back, so the menu is the normal game again', () => {
        const { actions, rerender } = mountRoute('#range', false, GameMode.CTF);
        rerender(inRange);
        rerender(hashGone);
        rerender({ ...afterEsc, hash: '' }); // the store: match over
        expect(actions.selectMode).toHaveBeenCalledTimes(1);
        expect(actions.selectMode).toHaveBeenCalledWith(GameMode.CTF);
        expect(actions.finishGame).toHaveBeenCalledTimes(1);
    });

    it('does not end a match the hook did not start', () => {
        const { actions, rerender } = mountRoute('#range', true, GameMode.GUN_GAME);
        rerender({ ...inRange, hash: '', selectedMode: GameMode.GUN_GAME });
        expect(actions.finishGame).not.toHaveBeenCalled();
    });

    it('does not end a plain match when there never was a range hash', () => {
        const { actions, rerender } = mountRoute('', true, GameMode.GUN_GAME);
        rerender({ ...inRange, hash: '#other', selectedMode: GameMode.GUN_GAME });
        expect(actions.finishGame).not.toHaveBeenCalled();
    });

    it('never finishes anything on the Esc path: the game already ended', () => {
        const { actions, rerender } = mountRoute('#range');
        rerender(inRange);
        rerender(afterEsc);
        rerender({ ...afterEsc, hash: '' });
        expect(actions.finishGame).not.toHaveBeenCalled();
    });

    it('does not finish a range that has not come up yet when the hash goes (nothing is playing)', () => {
        const { actions, rerender } = mountRoute('#range');
        rerender({ ...inRange, hash: '', isPlaying: false });
        expect(actions.finishGame).not.toHaveBeenCalled();
    });

    it('under StrictMode: one start, and one finish when the hash goes', () => {
        const { actions, rerender } = mountRoute('#range', false, GameMode.GUN_GAME, MapId.DEFAULT, { strict: true });
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        rerender(inRange);
        rerender(hashGone);
        expect(actions.startGame).toHaveBeenCalledTimes(1);
        expect(actions.finishGame).toHaveBeenCalledTimes(1);
    });
});
