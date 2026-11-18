// One tile of the watch screen: the MatchTile with a label over it (the two names, the live score and,
// until the match shows, why not). Clicking it expands it to the whole screen, or back.

import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { TranslationKeys } from '../../../i18n/locales';
import type { BracketCell } from '../../../game/tournament/bracketView';
import { focusRing } from '../TournamentFrame';
import { MatchTile, type TileScore, type TileStatus } from './MatchTile';

const STATUS_KEYS: Partial<Record<TileStatus, keyof TranslationKeys>> = {
    connecting: 'tournament.watch.connecting',
    full: 'tournament.watch.full',
    ended: 'tournament.watch.ended',
    host_left: 'tournament.watch.hostLeft',
};

interface Props {
    cell: BracketCell;
    peerId: string;
    audible: boolean;
    expanded: boolean;
    status: TileStatus | undefined;
    score: [number, number] | null;
    onToggle: () => void;
    onStatus: (s: TileStatus) => void;
    onScore: (players: TileScore[]) => void;
}

export const WatchTile: React.FC<Props> = ({ cell, peerId, audible, expanded, status, score, onToggle, onStatus, onScore }) => {
    const { t } = useTranslation();
    const nameA = cell.a?.nickname ?? '?';
    const nameB = cell.b?.nickname ?? '?';
    const statusKey = STATUS_KEYS[status ?? 'connecting'];
    return (
        <div role="button" tabIndex={0} aria-pressed={expanded} aria-label={t('tournament.watch.tile', nameA, nameB)}
            onClick={onToggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
            className={`ap-panel ap-watch-tile relative min-h-0 min-w-0 cursor-pointer overflow-hidden rounded border-2 ${audible ? 'border-bay-hazard' : 'border-bay-plate'} ${focusRing}`}>
            <MatchTile peerId={peerId} audible={audible} expanded={expanded} onStatus={onStatus} onScore={onScore} />
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2 rounded bg-bay-ink/85 px-2 py-1 text-sm font-semibold phone:text-xs">
                <span className="truncate">{nameA}</span>
                <span className="font-display font-black tabular-nums text-bay-hazard">{score ? `${score[0]}:${score[1]}` : '–'}</span>
                <span className="truncate">{nameB}</span>
            </div>
            {statusKey && (
                <p className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center font-display text-xl font-extrabold uppercase text-bay-dust">
                    {t(statusKey)}
                </p>
            )}
            {expanded && (
                <p className="pointer-events-none absolute bottom-2 left-1/2 m-0 -translate-x-1/2 rounded bg-bay-ink/85 px-2 py-1 text-xs text-bay-dust">
                    {t('tournament.watch.collapse')}
                </p>
            )}
        </div>
    );
};
