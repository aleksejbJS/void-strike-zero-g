// The strip on top of the watch screen: the whole bracket in small (one row per round, rounds side by side, so
// it stays one compact line on a laptop), a tick box on each live match to pick the ones on screen, and the live
// score of the watched ones (the others only say LIVE).

import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { roundName, type BracketCell } from '../../../game/tournament/bracketView';

interface Props {
    columns: BracketCell[][];
    size: 4 | 8;
    /** Match ids with a tile on screen. */
    watched: ReadonlySet<string>;
    /** The live score of a watched match as [seat A, seat B], once its tile reports one. */
    scoreOf: (cell: BracketCell) => [number, number] | null;
    /** False once every tile slot is taken: live matches that are not watched cannot be ticked then. */
    canWatchMore: boolean;
    onToggle: (matchId: string) => void;
}

const badge = 'shrink-0 rounded-sm px-1 text-[10px] font-bold uppercase leading-4';
const scoreText = 'shrink-0 font-display font-black tabular-nums';

const StripMatch: React.FC<{ cell: BracketCell } & Omit<Props, 'columns' | 'size'>> = ({ cell, watched, scoreOf, canWatchMore, onToggle }) => {
    const { t } = useTranslation();
    const { match, live } = cell;
    const nameA = cell.a?.nickname ?? '?';
    const nameB = cell.b?.nickname ?? '?';
    const isWatched = watched.has(match.id);
    const score = isWatched ? scoreOf(cell) : null;
    const done = match.status === 'done';

    const result = (() => {
        if (live) return score ? <span className={`${scoreText} text-bay-hazard`}>{`${score[0]}:${score[1]}`}</span>
            : <span className={`${badge} bg-bay-signal text-bay-chalk`}>{t('tournament.bracket.live')}</span>;
        if (!done) return null;
        if (match.decidedBy === 'walkover') return <span className={`${badge} bg-bay-plate text-bay-dust`}>{t('tournament.bracket.walkover')}</span>;
        return <span className={`${scoreText} text-bay-dust`}>{`${match.scoreA}:${match.scoreB}`}</span>;
    })();

    return (
        <li aria-label={t('tournament.watch.tile', nameA, nameB)}
            className={`flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs ${isWatched ? 'border-bay-hazard bg-bay-steel' : 'border-bay-plate bg-bay-panel'}`}>
            {live && (
                <input type="checkbox" checked={isWatched} disabled={!isWatched && !canWatchMore}
                    aria-label={t('tournament.watch.pick', nameA, nameB)} onChange={() => onToggle(match.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-[#FFC21A]" />
            )}
            <span className={`max-w-[9rem] truncate ${done || live ? 'text-bay-chalk' : 'text-bay-dust'}`}>{nameA} – {nameB}</span>
            {result}
        </li>
    );
};

export const WatchStrip: React.FC<Props> = ({ columns, size, ...rest }) => {
    const { t } = useTranslation();
    return (
        <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
            {columns.map((cells, round) => {
                const heading = t(`tournament.col.${roundName(round, size)}`);
                return (
                    <div key={round} className="flex shrink-0 flex-col gap-0.5">
                        <h3 className="m-0 font-display text-xs font-extrabold uppercase leading-4 tracking-wide text-bay-dust">{heading}</h3>
                        <ol aria-label={heading} className="m-0 flex list-none flex-row flex-wrap gap-1 p-0">
                            {cells.map(cell => <StripMatch key={cell.match.id} cell={cell} {...rest} />)}
                        </ol>
                    </div>
                );
            })}
        </div>
    );
};
