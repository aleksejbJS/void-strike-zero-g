// The bottom of the Top table, about the player looking at it: their own place below a "· · ·" gap when
// they are outside the shown rows, "not ranked yet", or, for a guest, an invitation to register.

import React from 'react';
import type { Board } from '../../leaderboard/leaderboardApi';
import type { Translate } from '../menu/types';
import { MessageRow, RankedRow } from './BoardRows';

/** Who is looking: a signed-in player with a nickname, a guest, or nobody yet (accounts still loading). */
export type Viewer = { kind: 'player'; nickname: string } | { kind: 'guest' } | { kind: 'unknown' };

/** True when the row is the viewer's own; nicknames are unique ignoring case. */
export const isOwnRow = (viewer: Viewer, nickname: string): boolean =>
    viewer.kind === 'player' && viewer.nickname.toLowerCase() === nickname.toLowerCase();

interface Props {
    board: Board;
    viewer: Viewer;
    onRegister: () => void;
    t: Translate;
}

export const OwnPlace: React.FC<Props> = ({ board, viewer, onRegister, t }) => {
    if (viewer.kind === 'guest') {
        return (
            <MessageRow className="mt-1 min-h-[44px] border-t-2 border-bay-plate pt-1 phone:min-h-[36px]">
                <span className="text-[15px] text-bay-dust phone:text-[13px]">{t('lb.guest')}</span>
                <button type="button" onClick={onRegister}
                    className="h-8 rounded bg-bay-hazard px-4 text-sm font-bold text-bay-ink hover:bg-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard phone:h-7 phone:px-3 phone:text-[13px]">
                    {t('lb.guest.button')}
                </button>
            </MessageRow>
        );
    }
    if (viewer.kind !== 'player') return null;
    if (board.top.some(row => isOwnRow(viewer, row.nickname))) return null; // highlighted in place
    if (board.me === null) {
        return (
            <MessageRow className="mt-1 h-[33px] border-t-2 border-bay-plate text-[15px] text-bay-dust phone:h-[26px] phone:text-[13px]">
                {t('lb.unranked')}
            </MessageRow>
        );
    }
    const lastShown = board.top.length > 0 ? board.top[board.top.length - 1].rank : 0;
    return (
        <>
            {board.me.rank > lastShown + 1 && (
                <div aria-hidden="true" className="py-0.5 text-center tracking-[4px] text-bay-edge phone:py-0 phone:leading-none">· · ·</div>
            )}
            <RankedRow rank={board.me.rank} name={t('lb.you', viewer.nickname)} value={board.me.value} own />
        </>
    );
};
