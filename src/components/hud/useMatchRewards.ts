// Pays out XP when a match ends. Polls the game state, so it works the same offline and online.

import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { GameState } from '../../types';
import { detectMatchEnd } from '../../game/build/matchOutcome';
import { addMatchXp, Reward } from '../../game/build/progress';
import { notifyProgressChanged } from '../../account/progressEvents';

const POLL_MS = 250;

/**
 * XP once per end screen. The reward is granted when the end appears (detectMatchEnd goes from null to a result)
 * and the same reward is returned while it stays up. Its key is ignored on purpose: online clients re-shift the
 * end times on every snapshot, and Gun Game keys can repeat across matches. Play resuming (null) re-arms it.
 * Nothing is paid until the local player has been seen in the room with no end showing: someone who joins while a
 * result is up (or a Gun Game room that never clears its winner) did not play that match.
 */
export function useMatchRewards(state: MutableRefObject<GameState>, localId: MutableRefObject<string>): Reward | null {
    const [reward, setReward] = useState<Reward | null>(null);
    const episode = useRef<Reward | null>(null); // survives effect restarts, so a restart never pays twice
    const seenPlay = useRef(false); // we were in the room while play was going on: only then does an end pay

    useEffect(() => {
        const poll = () => {
            const end = detectMatchEnd(state.current, localId.current);
            if (!end) {
                if (state.current.players.some(p => p.id === localId.current)) seenPlay.current = true;
                if (episode.current) { episode.current = null; setReward(null); }
                return;
            }
            if (episode.current || !seenPlay.current) return;
            episode.current = addMatchXp(end.won);
            notifyProgressChanged(); // a logged-in player's new XP goes to the cloud
            setReward(episode.current);
        };
        poll();
        const timer = setInterval(poll, POLL_MS);
        return () => clearInterval(timer);
    }, [state, localId]);

    return reward;
}
