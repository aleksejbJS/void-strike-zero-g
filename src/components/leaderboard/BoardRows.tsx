// Building blocks of the Top table: the column layout, one ranked row, and a full-width message row.

import React from 'react';
import { formatValue } from './boardCategories';

/** Rank / player / value: shared by the header and every row so the columns line up. */
export const ROW_GRID = 'grid grid-cols-[52px_minmax(0,1fr)_minmax(72px,auto)] items-center gap-x-3 px-4 phone:grid-cols-[36px_minmax(0,1fr)_minmax(56px,auto)] phone:px-3';

// Places 1-3: gold, white, bronze; the rest in dust
const RANK_TINT: Record<number, string> = { 1: 'text-bay-hazard', 2: 'text-bay-chalk', 3: 'text-bay-bronze' };

interface RankedRowProps {
    rank: number;
    name: string;
    value: number;
    /** The signed-in player's own row: hazard yellow. */
    own?: boolean;
}

export const RankedRow: React.FC<RankedRowProps> = ({ rank, name, value, own = false }) => (
    <div role="row" aria-current={own ? 'true' : undefined}
        className={`${ROW_GRID} h-[33px] text-[15px] phone:h-[26px] phone:text-[13px] ${own ? 'rounded-sm bg-bay-hazard font-semibold text-bay-ink' : 'border-b border-bay-steel last:border-b-0'}`}>
        <span role="cell" className={`font-bold tabular-nums ${own ? 'text-bay-ink' : RANK_TINT[rank] ?? 'text-bay-dust'}`}>{rank}</span>
        <span role="cell" className="truncate" title={name}>{name}</span>
        <span role="cell" className="text-right font-bold tabular-nums">{formatValue(value)}</span>
    </div>
);

/** One row across the whole table: loading, empty, error, "not ranked yet", the guest's invitation. */
export const MessageRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div role="row" className={`flex items-center gap-3 px-4 phone:px-3 ${className}`}>
        <div role="cell" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
    </div>
);
