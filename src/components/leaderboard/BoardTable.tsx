// The Top table: rank / player / value, places 1-3 tinted, the viewer's own row in hazard yellow,
// plus the loading, empty and error (with Retry) states.

import React from 'react';
import type { Translate } from '../menu/types';
import type { BoardState } from './useBoard';
import { MessageRow, RankedRow, ROW_GRID } from './BoardRows';
import { isOwnRow, OwnPlace, type Viewer } from './OwnPlace';

interface Props {
    /** The board's name, also the heading of the value column ("Kills"). */
    valueLabel: string;
    state: BoardState;
    viewer: Viewer;
    onRetry: () => void;
    onRegister: () => void;
    t: Translate;
}

const messageRow = 'h-[66px] text-[15px] text-bay-dust phone:h-12 phone:text-[13px]';

const Body: React.FC<Omit<Props, 'valueLabel'>> = ({ state, viewer, onRetry, onRegister, t }) => {
    if (state.status === 'loading') return <MessageRow className={messageRow}>{t('lb.loading')}</MessageRow>;
    if (state.status === 'error') {
        return (
            <MessageRow className={messageRow}>
                <span className="text-bay-chalk">{t('lb.error')}</span>
                <button type="button" onClick={onRetry}
                    className="h-8 rounded border-2 border-bay-edge bg-bay-steel px-4 text-sm font-semibold text-bay-chalk hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard">
                    {t('lb.retry')}
                </button>
            </MessageRow>
        );
    }
    const { board } = state;
    return (
        <>
            {board.top.length === 0
                ? <MessageRow className={messageRow}>{t('lb.empty')}</MessageRow>
                : board.top.map(row => (
                    <RankedRow key={row.rank} rank={row.rank} name={row.nickname} value={row.value} own={isOwnRow(viewer, row.nickname)} />
                ))}
            <OwnPlace board={board} viewer={viewer} onRegister={onRegister} t={t} />
        </>
    );
};

export const BoardTable: React.FC<Props> = ({ valueLabel, ...rest }) => (
    <div role="table" aria-label={valueLabel} aria-busy={rest.state.status === 'loading'}
        className="min-w-0 rounded border-2 border-bay-plate bg-bay-panel pb-1">
        <div role="row" className={`${ROW_GRID} h-9 border-b-2 border-bay-plate text-xs font-semibold uppercase tracking-[1px] text-bay-dust phone:h-7 phone:text-[11px]`}>
            <span role="columnheader">#</span>
            <span role="columnheader">{rest.t('lb.col.player')}</span>
            <span role="columnheader" className="max-w-[160px] truncate text-right">{valueLabel}</span>
        </div>
        <Body {...rest} />
    </div>
);
