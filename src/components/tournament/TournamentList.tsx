// Menu → Tournaments: the open tournaments (refreshed every 10 s), sign-up, watching, and creating one.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useUIStore } from '../../store/uiStore';
import { listTournaments, type TournamentListItem } from '../../tournament/tournamentList';
import { ticketFor } from '../../tournament/seatStore';
import type { SeatTicket, TournamentErrorCode } from '../../tournament/types';
import { CreateTournamentForm } from './CreateTournamentForm';
import { TournamentListRow } from './TournamentListRow';
import { ErrorLine, TournamentFrame, primaryButton } from './TournamentFrame';
import { useSignUp, useTournamentNickname } from './useSignUp';
import { toErrorCode, useTournamentCall } from './useTournamentCall';

const POLL_MS = 10_000;

/** The list, read now and every 10 s; a tick is skipped while the previous read is still running. */
const usePolledList = () => {
    const [items, setItems] = useState<TournamentListItem[] | null>(null);
    const [error, setError] = useState<TournamentErrorCode | null>(null);
    useEffect(() => {
        let active = true;
        let loading = false;
        const load = () => {
            if (loading) return;
            loading = true;
            listTournaments().then(
                (next) => { if (active) { setItems(next); setError(null); } },
                (failure: unknown) => { if (active) setError(toErrorCode(failure)); },
            ).finally(() => { loading = false; });
        };
        load();
        const timer = setInterval(load, POLL_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);
    return { items, error };
};

export const TournamentList: React.FC<{ onCustomize: () => void }> = ({ onCustomize }) => {
    const { t } = useTranslation();
    const { actions } = useUIStore();
    const { items, error: loadError } = usePolledList();
    const nickname = useTournamentNickname();
    const call = useTournamentCall();
    const openLobby = useCallback((ticket: SeatTicket) => actions.openTournament(ticket.tournamentId), [actions]);
    const signUp = useSignUp(call, onCustomize, openLobby);
    const [creating, setCreating] = useState(false);

    const startCreate = () => {
        if (!nickname) onCustomize();
        else setCreating(true);
    };

    return (
        <TournamentFrame title={t('tournament.list.title')} onBack={actions.closeTournaments}>
            <ErrorLine code={call.error ?? loadError} />
            {items === null && !loadError && <p className="m-0 text-sm text-bay-dust">{t('tournament.list.loading')}</p>}
            {items !== null && items.length === 0 && <p className="m-0 text-[15px] text-bay-dust">{t('tournament.list.empty')}</p>}
            {items !== null && items.length > 0 && (
                <ul className="m-0 flex max-h-[min(52vh,420px)] list-none flex-col gap-1.5 overflow-y-auto p-0 phone:max-h-[45vh]">
                    {items.map(item => (
                        <TournamentListRow key={item.tournament.id} item={item} hasSeat={ticketFor(item.tournament.id) !== null}
                            busy={call.busy} onSignUp={signUp} onOpen={actions.openTournament} onWatch={actions.openWatch} />
                    ))}
                </ul>
            )}
            {creating ? (
                <CreateTournamentForm nickname={nickname} onCancel={() => setCreating(false)} />
            ) : (
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={primaryButton} onClick={startCreate}>{t('tournament.list.create')}</button>
                    <span className="text-sm text-bay-dust">{t('tournament.list.linkHint')}</span>
                </div>
            )}
        </TournamentFrame>
    );
};
