// A tournament before its start: the 8 seats, the rules, the invite link, and Sign up / Leave / Start.
// Start is for the creator only, and needs at least 2 humans.

import React, { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useUIStore } from '../../store/uiStore';
import { forgetTicket, ticketFor } from '../../tournament/seatStore';
import { leaveTournament, startTournament } from '../../tournament/tournamentApi';
import { TournamentError, type SeatTicket, type TournamentSnapshot } from '../../tournament/types';
import { LobbySeats } from './LobbySeats';
import { ErrorLine, ghostButton, primaryButton } from './TournamentFrame';
import { useSignUp } from './useSignUp';
import { useTournamentCall } from './useTournamentCall';

const MIN_HUMANS = 2;
const SEATS = 8;

/** The invite link (`?tournament=<id>`, opened by App) and copying it. */
const useCopyLink = (id: string) => {
    const link = `${window.location.origin}${window.location.pathname}?tournament=${id}`;
    const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
    const copyLink = () => {
        const fail = (reason: unknown) => {
            console.warn('[tournament] could not copy the invite link, showing it instead', reason);
            setCopy('failed');
        };
        if (!navigator.clipboard) {
            fail(new Error('no clipboard access'));
            return;
        }
        navigator.clipboard.writeText(link).then(() => setCopy('copied'), fail);
    };
    return { link, copy, copyLink };
};

interface Props {
    snapshot: TournamentSnapshot;
    onCustomize: () => void;
}

export const TournamentLobby: React.FC<Props> = ({ snapshot, onCustomize }) => {
    const { t } = useTranslation();
    const { actions } = useUIStore();
    const { tournament, seats } = snapshot;
    const [ticket, setTicket] = useState<SeatTicket | null>(() => ticketFor(tournament.id));
    const call = useTournamentCall();
    const signUp = useSignUp(call, onCustomize, setTicket);
    const { link, copy, copyLink } = useCopyLink(tournament.id);

    const humans = seats.filter(s => !s.isBot).length;
    const isCreator = ticket !== null && ticket.seat === tournament.creatorSeat;

    const start = () => {
        if (ticket) void call.run(() => startTournament(ticket)); // the feed then shows the running tournament
    };
    const leave = useCallback(() => {
        if (!ticket) return;
        void call.run(async () => {
            try {
                await leaveTournament(ticket);
            } catch (failure) {
                // The server no longer knows this seat: the ticket is useless, drop it (and still show why)
                if (failure instanceof TournamentError && failure.code === 'bad_ticket') {
                    forgetTicket(tournament.id);
                    setTicket(null);
                }
                throw failure;
            }
            forgetTicket(tournament.id);
            actions.openTournaments();
        });
    }, [ticket, call, tournament.id, actions]);

    return (
        <>
            <div className="flex flex-col gap-1">
                <h2 className="m-0 font-display text-[28px] font-extrabold uppercase leading-tight tracking-wide phone:text-lg">
                    {`${tournament.name} · ${humans} / ${SEATS}`}
                </h2>
                <p className="m-0 text-sm text-bay-dust">{t('tournament.lobby.rules')}</p>
            </div>

            <LobbySeats seats={seats} creatorSeat={tournament.creatorSeat} mySeat={ticket?.seat ?? null} />

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={ghostButton} onClick={copyLink}>{t('tournament.lobby.copyLink')}</button>
                {isCreator && (
                    <button type="button" className={primaryButton} disabled={humans < MIN_HUMANS || call.busy} onClick={start}>
                        {t('tournament.lobby.start')}
                    </button>
                )}
                {ticket ? (
                    <button type="button" className={ghostButton} disabled={call.busy} onClick={leave}>{t('tournament.lobby.leave')}</button>
                ) : (
                    <button type="button" className={primaryButton} disabled={call.busy} onClick={() => signUp(tournament.id)}>
                        {t('tournament.list.signUp')}
                    </button>
                )}
                <span className="text-sm text-bay-dust">{t('tournament.lobby.drawHint')}</span>
            </div>

            {copy === 'copied' && <p role="status" className="m-0 text-sm text-bay-hazard">{t('tournament.lobby.copied')}</p>}
            {copy === 'failed' && <p className="m-0 select-all break-all text-sm text-bay-chalk">{t('tournament.lobby.copyFailed', link)}</p>}
            {isCreator && humans < MIN_HUMANS && <p className="m-0 text-sm text-bay-dust">{t('tournament.error.not_enough_players')}</p>}
            {ticket && !isCreator && <p className="m-0 text-sm text-bay-dust">{t('tournament.lobby.waitStart')}</p>}
            <ErrorLine code={call.error} />
        </>
    );
};
