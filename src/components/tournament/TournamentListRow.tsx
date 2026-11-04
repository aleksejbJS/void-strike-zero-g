// One row of the tournament list: name, creator, then seats (a lobby) or the current round (running),
// and the one button that fits: Sign up, Open (this browser already has a seat), Watch or Results.

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { roundName } from '../../game/tournament/bracketView';
import type { TournamentListItem } from '../../tournament/tournamentList';
import { ghostButton, primaryButton } from './TournamentFrame';

interface Props {
    item: TournamentListItem;
    hasSeat: boolean;
    busy: boolean;
    onSignUp: (id: string) => void;
    onOpen: (id: string) => void;
    onWatch: (id: string) => void;
}

const SEATS = 8;

export const TournamentListRow: React.FC<Props> = ({ item, hasSeat, busy, onSignUp, onOpen, onWatch }) => {
    const { t } = useTranslation();
    const { tournament, creator, humans, round } = item;

    const progress = (() => {
        if (tournament.status === 'lobby') return `${humans}/${SEATS}`;
        if (tournament.status === 'running') {
            const name = round !== null && tournament.size !== null ? t(`tournament.round.${roundName(round, tournament.size)}`) : '…';
            return t('tournament.list.running', name);
        }
        return t('tournament.list.finished');
    })();
    const detail = [creator !== null ? t('tournament.list.creator', creator) : null, progress].filter(Boolean).join(' · ');

    const button = (() => {
        const id = tournament.id;
        switch (tournament.status) {
            case 'lobby':
                return hasSeat
                    ? <button type="button" className={ghostButton} onClick={() => onOpen(id)}>{t('tournament.list.open')}</button>
                    : <button type="button" className={primaryButton} disabled={busy} onClick={() => onSignUp(id)}>{t('tournament.list.signUp')}</button>;
            case 'running':
                return <button type="button" className={ghostButton} onClick={() => onWatch(id)}>{t('tournament.list.watch')}</button>;
            case 'finished':
                return <button type="button" className={ghostButton} onClick={() => onOpen(id)}>{t('tournament.list.results')}</button>;
            default:
                return null; // expired tournaments are not listed
        }
    })();

    return (
        <li className="flex items-center justify-between gap-3 rounded border border-bay-plate bg-bay-steel px-4 py-2.5 phone:px-2.5 phone:py-1.5">
            <span className="min-w-0 truncate text-[15px] phone:text-[13px]">
                <b className="font-semibold">{tournament.name}</b>{' '}
                <span className="text-sm text-bay-dust phone:text-xs">· {detail}</span>
            </span>
            {button}
        </li>
    );
};
