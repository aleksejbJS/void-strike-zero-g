// The hidden #range address: opening it starts the offline test range, like #ads-admin opens the ads page.
// When the range (or any match under that hash) ends, the hash is dropped so the menu stays put, and the
// mode and map the menu had selected before the range are put back. Removing the hash while the range runs
// ends it too (finishGame(0): the range's score is never saved), so the hash and the screen cannot disagree.

import { useEffect, useRef } from 'react';
import { GameMode, MapId, NetworkMode } from '../../types';
import { MODE_ORDER } from '../menu/modeInfo';

export const RANGE_HASH = '#range';

/** The slice of the UI store this hook needs: a narrow type, so tests can pass plain mocks. */
export interface RangeRouteActions {
    startGame(mode: GameMode): void;
    setNetworkState(mode: NetworkMode, gameId: string | null): void;
    selectMode(mode: GameMode): void;
    selectMap(map: MapId): void;
    finishGame(score: number): void;
}

// idle: nothing done for this hash yet; requested: startGame was called, the match is not up yet;
// played: a match has run under this hash, so its end must clear the hash.
type Phase = 'idle' | 'requested' | 'played';

/** removes #range without a reload or a history entry, then lets hash listeners (App's useHash) see the change */
const dropRangeHash = () => {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', pathname + search);
    // replaceState fires no hashchange: without it a later #range would look like "no change" to useHash
    window.dispatchEvent(new HashChangeEvent('hashchange'));
};

/** The mode to show in the menu after the range: what was selected, unless that is not a menu mode (RANGE, DUEL). */
const menuModeAfterRange = (selected: GameMode): GameMode => (MODE_ORDER.includes(selected) ? selected : GameMode.DEATHMATCH);

export function useRangeRoute(hash: string, isPlaying: boolean, selectedMode: GameMode, selectedMap: MapId, actions: RangeRouteActions): void {
    const phase = useRef<Phase>('idle');
    const modeBefore = useRef<GameMode | null>(null); // set while a range this hook started is waiting or running
    const mapBefore = useRef<MapId>(selectedMap);     // the menu's map when that range started
    const rangeUp = useRef(false);                    // that range has been on screen

    // Deps: only hash and isPlaying decide what happens. `actions` is left out on purpose: the store's actions are
    // stable dispatch wrappers, and re-running on new identities could drop the hash twice. `selectedMode` and
    // `selectedMap` are read once, at the start.
    useEffect(() => {
        if (hash !== RANGE_HASH) {
            phase.current = 'idle';
            // The hash was removed (or replaced) under a running range this hook started: that ends the range
            if (isPlaying && modeBefore.current !== null) actions.finishGame(0);
            return;
        }
        if (isPlaying) { phase.current = 'played'; return; } // never interrupts a running match
        if (phase.current === 'idle') {
            phase.current = 'requested'; // StrictMode runs this effect twice on mount: only one start
            modeBefore.current = menuModeAfterRange(selectedMode);
            mapBefore.current = selectedMap;
            actions.setNetworkState(NetworkMode.OFFLINE, null); // the range is never online, whatever was set before
            actions.startGame(GameMode.RANGE);
        } else if (phase.current === 'played') {
            dropRangeHash();
        }
    }, [hash, isPlaying]);

    // The range leaves selectedMode on RANGE, and the menu would offer, host and relaunch it: put the old mode back
    // when the range ends, whether or not the hash is still #range by then. The map goes back after the mode: the
    // menu mounts on RANGE, where only the standard map is allowed, and resets any other map to the default.
    useEffect(() => {
        if (isPlaying) { rangeUp.current = modeBefore.current !== null; return; }
        if (!rangeUp.current || modeBefore.current === null) return;
        const back = modeBefore.current;
        rangeUp.current = false;
        modeBefore.current = null;
        actions.selectMode(back);
        actions.selectMap(mapBefore.current);
    }, [isPlaying]);
}
