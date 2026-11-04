// How a tournament duel hooks into GameCanvas's ClientSession callbacks: after a join (first or again) the
// duel is told, and a lost link goes to the duel, which reconnects or leaves, instead of the plain
// "disconnected" error of other online games. Outside a tournament the callbacks stay as they are.

import type { SessionCallbacks } from '../../game/net/clientSession';
import type { TournamentMatchSignals } from './useTournamentMatch';

export const withTournamentSignals = (callbacks: SessionCallbacks, signals: TournamentMatchSignals | null): SessionCallbacks => {
    if (!signals) return callbacks;
    return {
        ...callbacks,
        onJoined: info => {
            callbacks.onJoined(info);
            signals.joined();
        },
        onDisconnected: () => signals.disconnected(),
    };
};
