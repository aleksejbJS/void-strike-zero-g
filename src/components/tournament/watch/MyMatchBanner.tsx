// On the watch screen: "Your match is starting…" while my own duel is being set up. The autopilot
// (TournamentAutopilot) starts it by itself; this only tells the player why the screen is about to change.

import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ticketFor } from '../../../tournament/seatStore';
import type { TournamentSnapshot } from '../../../tournament/types';
import { myTurnState } from '../autopilot/useMyTurn';

export const MyMatchBanner: React.FC<{ snapshot: TournamentSnapshot }> = ({ snapshot }) => {
    const { t } = useTranslation();
    const id = snapshot.tournament.id;
    const ticket = useMemo(() => ticketFor(id), [id]);
    const { turn, alreadyPlayed } = myTurnState(snapshot, ticket);
    const starting = !alreadyPlayed && (turn.kind === 'host' || turn.kind === 'join' || turn.kind === 'wait-host');
    if (!starting) return null;
    return (
        <p role="status" className="ap-panel ap-primary m-0 shrink-0 bg-bay-hazard px-3 py-1 text-center font-display text-sm font-extrabold uppercase text-bay-ink">
            {t('tournament.banner.starting')}
        </p>
    );
};
