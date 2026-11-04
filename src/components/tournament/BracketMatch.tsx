// One match of the bracket: its two seats, the score once it is decided (the database only learns the score at
// the end; live scores are on the watch screen), the winner in hazard yellow and the loser struck through.

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { BracketCell } from '../../game/tournament/bracketView';
import type { SeatRow } from '../../tournament/types';

interface Props {
    cell: BracketCell;
    /** My own match: outlined. */
    mine: boolean;
    mySeat: number | null;
}

const SeatLine: React.FC<{ seat: SeatRow | null; score: number | null; won: boolean; lost: boolean; me: boolean }> = ({
    seat, score, won, lost, me,
}) => {
    const { t } = useTranslation();
    const tone = won ? 'font-bold text-bay-hazard' : lost ? 'text-bay-dust line-through' : seat ? 'text-bay-chalk' : 'text-bay-dust';
    return (
        <div className="flex items-center justify-between gap-2">
            <span className={`min-w-0 truncate ${tone}`}>{seat ? (me ? t('tournament.lobby.you', seat.nickname) : seat.nickname) : t('tournament.bracket.open')}</span>
            {score !== null && <span className={`shrink-0 font-display font-black tabular-nums ${won ? 'text-bay-hazard' : 'text-bay-dust'}`}>{score}</span>}
        </div>
    );
};

export const BracketMatch: React.FC<Props> = ({ cell, mine, mySeat }) => {
    const { t } = useTranslation();
    const { match, a, b, live } = cell;
    const done = match.status === 'done';
    const walkover = done && match.decidedBy === 'walkover';
    const showScore = done && !walkover;
    const winnerA = done && match.winnerSeat !== null && match.winnerSeat === match.seatA;
    const winnerB = done && match.winnerSeat !== null && match.winnerSeat === match.seatB;

    return (
        <li aria-current={mine ? 'true' : undefined}
            className={`relative flex flex-col gap-0.5 rounded border border-bay-plate bg-bay-steel px-2.5 py-1.5 text-sm phone:py-1 phone:text-xs ${mine ? 'outline outline-2 outline-bay-hazard' : ''}`}>
            {(live || walkover) && (
                <span className={`absolute -top-2 right-2 rounded-sm px-1 text-[10px] font-bold uppercase leading-4 ${live ? 'bg-bay-signal text-bay-chalk' : 'bg-bay-plate text-bay-dust'}`}>
                    {live ? t('tournament.bracket.live') : t('tournament.bracket.walkover')}
                </span>
            )}
            <SeatLine seat={a} score={showScore ? match.scoreA : null} won={winnerA} lost={winnerB} me={a !== null && a.seat === mySeat} />
            <SeatLine seat={b} score={showScore ? match.scoreB : null} won={winnerB} lost={winnerA} me={b !== null && b.seat === mySeat} />
        </li>
    );
};
