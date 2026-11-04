// One tournament, live, for a component: the shared copy from liveTournaments (first read, Realtime feed,
// resolveStale while it runs, lobby re-reads). Screens that show the same tournament share one feed.

import { useEffect, useState } from 'react';
import { subscribeTournament, type LiveTournament } from './liveTournaments';

const NOTHING_YET: LiveTournament = { snapshot: null, error: null };

export const useTournament = (id: string): LiveTournament => {
    const [live, setLive] = useState<LiveTournament>(NOTHING_YET);
    useEffect(() => {
        setLive(NOTHING_YET);
        return subscribeTournament(id, setLive);
    }, [id]);
    return live;
};
