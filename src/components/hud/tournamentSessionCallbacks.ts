// How a tournament duel hooks into GameCanvas's ClientSession callbacks: after a join (first or again) the
// duel is told; a lost link, and a join refused as full (a reloaded guest whose old link still holds the
// seat for a few seconds), go to the duel, which dials again or leaves, instead of the plain error of other
// online games. Outside a tournament the callbacks stay as they are.

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
        onRejected: reason => {
            if (reason === 'full') signals.rejected();
            else callbacks.onRejected(reason);
        },
        onDisconnected: () => signals.disconnected(),
    };
};
