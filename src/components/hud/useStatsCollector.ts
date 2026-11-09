// Adds what the local player did (kills, captures, hooks, ...) and the time spent playing to the lifetime
// counters. Polls the game state like useMatchRewards, so it works the same offline and online.

import { MutableRefObject, useEffect, useRef } from 'react';
import { GameState } from '../../types';
import { detectMatchEnd } from '../../game/build/matchOutcome';
import { CollectorMemory, collectDeltas, playTimeDelta } from '../../game/stats/statsCollector';
import { addStats } from '../../game/stats/lifetimeStats';
import type { Stats } from '../../game/stats/statKeys';
import { notifyProgressChanged } from '../../account/progressEvents';

const POLL_MS = 250;

/** Play time runs while the local player is in a match that is still going and the tab is on screen. */
const isPlaying = (state: GameState, localId: string): boolean =>
    state.players.some(p => p.id === localId)
    && detectMatchEnd(state, localId) === null
    && document.visibilityState === 'visible';

/**
 * Counters are credited as they grow, so leaving a match halfway keeps what was done. The memory lives in a ref:
 * an effect restart never credits the same counters twice. It is keyed by the local id as well as the session, so
 * a new entity in the same room (a rejoin) is counted from zero rather than against the old one's high-water mark.
 */
export function useStatsCollector(state: MutableRefObject<GameState>, localId: MutableRefObject<string>): void {
    const memory = useRef<CollectorMemory>({ session: null, seen: {} });
    const credited = useRef(false); // something was added: the cloud copy needs a push when we leave

    useEffect(() => {
        let last = Date.now();
        const poll = () => {
            const now = Date.now();
            const elapsed = now - last;
            last = now;
            const gs = state.current;
            const id = localId.current;
            const session = gs.statsSession === undefined ? undefined : `${id}|${gs.statsSession}`;
            const delta: Stats = collectDeltas(memory.current, session, gs.playerStats?.[id]);
            const playMs = playTimeDelta(elapsed, isPlaying(gs, id));
            if (playMs > 0) delta.playMs = playMs;
            if (Object.keys(delta).length === 0) return;
            addStats(delta);
            credited.current = true;
        };
        poll();
        const timer = setInterval(poll, POLL_MS);
        return () => {
            clearInterval(timer);
            poll(); // credit what happened since the last tick (up to POLL_MS) before the state goes away
            if (credited.current) {
                credited.current = false;
                notifyProgressChanged(); // a logged-in player's new totals go to the cloud
            }
        };
    }, [state, localId]);
}
