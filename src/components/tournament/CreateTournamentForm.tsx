// "+ Create tournament": asks for the tournament's name, creates it with the player's nickname as seat 0,
// keeps the seat ticket and opens the new lobby.

import React, { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useUIStore } from '../../store/uiStore';
import { createTournament } from '../../tournament/tournamentApi';
import { saveTicket } from '../../tournament/seatStore';
import { ErrorLine, focusRing, ghostButton, primaryButton } from './TournamentFrame';
import { useTournamentCall } from './useTournamentCall';

const MAX_NAME = 32; // the database accepts 1-32 characters

interface Props {
    nickname: string;
    onCancel: () => void;
}

export const CreateTournamentForm: React.FC<Props> = ({ nickname, onCancel }) => {
    const { t } = useTranslation();
    const { actions } = useUIStore();
    const { busy, error, run } = useTournamentCall();
    const [name, setName] = useState('');
    const trimmed = name.trim();

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trimmed || busy) return;
        void run(async () => {
            const ticket = await createTournament(trimmed, nickname);
            saveTicket(ticket);
            actions.openTournament(ticket.tournamentId);
        });
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="tournament-name" className="text-sm text-bay-dust">{t('tournament.create.label')}</label>
            <div className="flex gap-2">
                <input id="tournament-name" value={name} maxLength={MAX_NAME} autoFocus onChange={e => setName(e.target.value)}
                    placeholder={t('tournament.create.placeholder')}
                    className={`h-10 min-w-0 flex-grow rounded border-2 border-bay-edge bg-bay-ink px-3 text-[15px] text-bay-chalk placeholder:text-bay-dust/70 focus:border-bay-hazard focus:outline-none phone:h-8 ${focusRing}`} />
                <button type="submit" className={primaryButton} disabled={!trimmed || busy}>
                    {busy ? t('tournament.busy') : t('tournament.create.submit')}
                </button>
                <button type="button" className={ghostButton} onClick={onCancel}>{t('tournament.create.cancel')}</button>
            </div>
            <ErrorLine code={error} />
        </form>
    );
};
