// The 8 seat tiles of a lobby: signed-up players first (the creator tagged, my seat outlined), then the free
// seats, which become bots at the start.

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { SeatRow } from '../../tournament/types';

const SEATS = 8;

interface Props {
    seats: SeatRow[];
    creatorSeat: number;
    mySeat: number | null;
}

export const LobbySeats: React.FC<Props> = ({ seats, creatorSeat, mySeat }) => {
    const { t } = useTranslation();
    const taken = [...seats].sort((a, b) => a.seat - b.seat).slice(0, SEATS);
    const free = SEATS - taken.length;
    const tile = 'flex min-h-[40px] items-center justify-between gap-2 rounded border px-3 py-2 text-[15px] phone:min-h-0 phone:px-2 phone:py-1 phone:text-[13px]';

    return (
        <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
            {taken.map(seat => (
                <li key={seat.seat}
                    className={`${tile} border-bay-plate bg-bay-steel ${seat.seat === mySeat ? 'outline outline-2 outline-bay-hazard' : ''}`}>
                    <span className="min-w-0 truncate">{seat.seat === mySeat ? t('tournament.lobby.you', seat.nickname) : seat.nickname}</span>
                    {seat.seat === creatorSeat && (
                        <span className="shrink-0 rounded-sm bg-bay-hazard px-1.5 text-xs font-bold uppercase text-bay-ink">{t('tournament.lobby.creator')}</span>
                    )}
                </li>
            ))}
            {Array.from({ length: free }, (_, i) => (
                <li key={`free-${i}`} className={`${tile} border-dashed border-bay-edge text-bay-dust`}>{t('tournament.lobby.free')}</li>
            ))}
        </ul>
    );
};
