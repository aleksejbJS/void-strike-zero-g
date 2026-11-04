// A running or finished tournament: the bracket (quarterfinal, semifinal, final, trophy), a banner about my
// part in it, and Watch. useMyTurn starts my duel by itself when it is ready.

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { TranslationKeys } from '../../i18n/locales';
import { useUIStore } from '../../store/uiStore';
import { awardTournament } from '../../tournament/awardTournament';
import { ticketFor } from '../../tournament/seatStore';
import type { TournamentSnapshot } from '../../tournament/types';
import { bracketColumns, roundName } from '../../game/tournament/bracketView';
import type { MyTurn } from '../../game/tournament/myTurn';
import { BracketMatch } from './BracketMatch';
import { ghostButton } from './TournamentFrame';
import { useMyTurn } from './useMyTurn';

const BANNERS: Partial<Record<MyTurn['kind'], keyof TranslationKeys>> = {
    champion: 'tournament.banner.champion',
    eliminated: 'tournament.banner.eliminated',
    'wait-host': 'tournament.banner.waitHost',
    'wait-round': 'tournament.banner.waitRound',
    host: 'tournament.banner.starting',
    join: 'tournament.banner.starting',
};

const columnHeading = 'm-0 mb-2 font-display text-sm font-extrabold uppercase tracking-wide text-bay-dust';
const columnList = 'm-0 flex flex-1 list-none flex-col justify-around gap-2 p-0';

export const BracketScreen: React.FC<{ snapshot: TournamentSnapshot }> = ({ snapshot }) => {
    const { t } = useTranslation();
    const { actions } = useUIStore();
    const { tournament, seats, matches } = snapshot;
    const ticket = useMemo(() => ticketFor(tournament.id), [tournament.id]);
    const { turn, alreadyPlayed } = useMyTurn(snapshot, ticket);
    const mySeat = ticket?.seat ?? null;

    // Champion, Finalist and Flawless are judged from every new snapshot; awardTournament pays each one once
    useEffect(() => {
        if (ticket) awardTournament(snapshot, ticket.seat);
    }, [snapshot, ticket]);

    const columns = bracketColumns(snapshot);
    const size = tournament.size ?? (columns[0]?.length === 4 ? 8 : 4);
    // My match: the latest one with my seat
    const myMatchId = mySeat === null ? null
        : [...matches].filter(m => m.seatA === mySeat || m.seatB === mySeat).sort((x, y) => y.round - x.round)[0]?.id ?? null;
    const champion = seats.find(s => s.seat === tournament.championSeat) ?? null;

    const bannerKey = alreadyPlayed ? 'tournament.banner.settling' : BANNERS[turn.kind];
    const banner = bannerKey ? t(bannerKey) : champion ? t('tournament.banner.winner', champion.nickname) : null;
    const highlight = turn.kind === 'champion' || (!alreadyPlayed && (turn.kind === 'host' || turn.kind === 'join'));

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="m-0 truncate font-display text-[28px] font-extrabold uppercase leading-tight tracking-wide phone:text-lg">{tournament.name}</h2>
                    <p className="m-0 text-sm text-bay-dust">{t('tournament.lobby.rules')}</p>
                </div>
                {tournament.status === 'running' && (
                    <button type="button" className={ghostButton} onClick={() => actions.openWatch(tournament.id)}>{t('tournament.list.watch')}</button>
                )}
            </div>

            {banner && (
                <p role="status" className={`m-0 rounded px-3 py-2 font-display text-lg font-extrabold uppercase phone:py-1 phone:text-sm ${highlight ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk'}`}>
                    {banner}
                </p>
            )}

            <div className="overflow-x-auto">
                <div className={`grid min-w-[560px] gap-3 ${size === 8 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {columns.map((cells, round) => {
                        const heading = t(`tournament.col.${roundName(round, size)}`);
                        return (
                            <div key={round} className="flex flex-col">
                                <h3 className={columnHeading}>{heading}</h3>
                                <ol aria-label={heading} className={columnList}>
                                    {cells.map(cell => <BracketMatch key={cell.match.id} cell={cell} mine={cell.match.id === myMatchId} mySeat={mySeat} />)}
                                </ol>
                            </div>
                        );
                    })}
                    <div className="flex flex-col">
                        <h3 className={columnHeading} aria-hidden="true">🏆</h3>
                        <ol aria-label={t('tournament.col.champion')} className={columnList}>
                            <li className={`rounded border-2 px-2.5 py-2 text-center font-display text-lg font-black uppercase ${champion ? 'border-bay-hazard text-bay-hazard' : 'border-dashed border-bay-edge text-bay-dust'}`}>
                                {champion ? champion.nickname : '?'}
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
        </>
    );
};
