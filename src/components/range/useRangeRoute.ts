// The hidden #range address: opening it starts the offline test range, like #ads-admin opens the ads page.
// When the range (or any match under that hash) ends, the hash is dropped so the menu stays put.

import { useEffect, useRef } from 'react';
import { GameMode, NetworkMode } from '../../types';

export const RANGE_HASH = '#range';

/** The slice of the UI store this hook needs: a narrow type, so tests can pass plain mocks. */
export interface RangeRouteActions {
    startGame(mode: GameMode): void;
    setNetworkState(mode: NetworkMode, gameId: string | null): void;
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

export function useRangeRoute(hash: string, isPlaying: boolean, actions: RangeRouteActions): void {
    const phase = useRef<Phase>('idle');

    useEffect(() => {
        if (hash !== RANGE_HASH) { phase.current = 'idle'; return; }
        if (isPlaying) { phase.current = 'played'; return; } // never interrupts a running match
        if (phase.current === 'idle') {
            phase.current = 'requested'; // StrictMode runs this effect twice on mount: only one start
            actions.setNetworkState(NetworkMode.OFFLINE, null); // the range is never online, whatever was set before
            actions.startGame(GameMode.RANGE);
        } else if (phase.current === 'played') {
            dropRangeHash();
        }
    }, [hash, isPlaying]);
}
