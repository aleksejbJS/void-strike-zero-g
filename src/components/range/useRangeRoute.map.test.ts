import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, MapId } from '../../types';
import { afterEsc, inRange, mountRoute } from './useRangeRouteTestKit';

// The menu forgets the map when it mounts on RANGE (the range allows only the standard map), so the hook keeps it.
describe('useRangeRoute: the map the menu shows afterwards', () => {
    beforeEach(() => { window.history.replaceState(null, '', '/#range'); });
    afterEach(() => { window.history.replaceState(null, '', '/'); });

    it('puts back the map that was selected before the range, after the mode', () => {
        const { actions, rerender } = mountRoute('#range', false, GameMode.DEATHMATCH, MapId.TUNNELS);
        rerender({ ...inRange });
        expect(actions.selectMap).not.toHaveBeenCalled(); // the range keeps its own map while it runs

        rerender(afterEsc);
        expect(actions.selectMap).toHaveBeenCalledTimes(1);
        expect(actions.selectMap).toHaveBeenCalledWith(MapId.TUNNELS);
        expect(actions.selectMode.mock.invocationCallOrder[0]).toBeLessThan(actions.selectMap.mock.invocationCallOrder[0]);
    });

    it('remembers the map from the start of the range, not from when it ends', () => {
        const { actions, rerender } = mountRoute('#range', false, GameMode.GUN_GAME, MapId.TUNNELS);
        rerender({ ...inRange, selectedMap: MapId.DEFAULT });
        rerender({ ...afterEsc, selectedMap: MapId.DEFAULT });
        expect(actions.selectMap).toHaveBeenCalledWith(MapId.TUNNELS);
    });

    it('restores it once, also when the hash edit ended the range', () => {
        const { actions, rerender } = mountRoute('#range', false, GameMode.DEATHMATCH, MapId.TUNNELS);
        rerender(inRange);
        rerender({ ...inRange, hash: '' });
        rerender({ ...afterEsc, hash: '' });
        rerender({ ...afterEsc, hash: '' });
        expect(actions.selectMap).toHaveBeenCalledTimes(1);
        expect(actions.selectMap).toHaveBeenCalledWith(MapId.TUNNELS);
    });

    it('leaves the map alone when the range was not started by the hook (a match was already running)', () => {
        const { actions, rerender } = mountRoute('#range', true, GameMode.GUN_GAME, MapId.TUNNELS);
        rerender({ hash: '#range', isPlaying: false, selectedMode: GameMode.GUN_GAME, selectedMap: MapId.TUNNELS });
        expect(actions.selectMap).not.toHaveBeenCalled();
    });
});
