// Watching a tournament: up to 4 live matches at once (MatchTile each), the bracket strip on top to pick them.
// A click expands a tile to the whole screen (click again or Esc to return); exactly one tile plays sound.
// Tiles that are not on screen are unmounted, not hidden: each one holds a WebGL context, a frame loop and a
// spectator seat on its host, which a hidden tile would keep for nothing (returning to the grid reconnects them).
// A tile whose host left is retried while its match is live (useTileStates).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useUIStore } from '../../../store/uiStore';
import { bracketColumns, type BracketCell } from '../../../game/tournament/bracketView';
import { useTournament } from '../../../tournament/useTournament';
import { BackButton, ErrorLine } from '../TournamentFrame';
import { liveScore } from './liveScore';
import { useIsPhone, useSwipe } from './usePhoneWatch';
import { useTileStates } from './useTileStates';
import { audibleTile, layoutFor, liveCells, MAX_TILES, watchedCells } from './watchLayout';
import { WatchStrip } from './WatchStrip';
import { WatchTile } from './WatchTile';

/** A host that reloads publishes a new peer id: that is a new link, so a new tile. */
const tileKey = (cell: BracketCell) => `${cell.match.id}:${cell.match.hostPeerId}`;

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="m-auto p-4 text-center text-[15px] text-bay-dust">{children}</p>
);

export const WatchScreen: React.FC<{ id: string }> = ({ id }) => {
    const { t } = useTranslation();
    const { state, actions } = useUIStore();
    const { snapshot, error } = useTournament(id);
    const phone = useIsPhone();
    const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set());
    const [expanded, setExpanded] = useState<string | null>(null);
    const [lastClicked, setLastClicked] = useState<string | null>(null);

    const live = useMemo(() => (snapshot ? liveCells(snapshot) : []), [snapshot]);
    const watched = watchedCells(live, unticked);
    const ids = watched.map(c => c.match.id);
    const openId = expanded !== null && ids.includes(expanded) ? expanded : null; // a finished match closes
    const soundId = audibleTile(ids, openId, lastClicked);
    // A phone shows only the tile with sound; a desktop shows the expanded tile alone, or all of them
    const shown = phone ? watched.filter(c => c.match.id === soundId)
        : openId ? watched.filter(c => c.match.id === openId) : watched;
    const { cols, rows } = layoutFor(shown.length, phone);
    const tileStates = useTileStates(watched.map(tileKey), shown.map(tileKey), openId ?? '');
    const { scores, statuses } = tileStates;

    useEffect(() => {
        if (openId === null) return undefined;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openId]);

    const toggleExpand = (matchId: string) => {
        setLastClicked(matchId);
        setExpanded(openId === matchId ? null : matchId);
    };
    const swipe = useSwipe((step) => {
        if (ids.length < 2 || soundId === null) return;
        const next = ids[(ids.indexOf(soundId) + step + ids.length) % ids.length];
        setLastClicked(next);
        setExpanded(e => (e === null ? null : next));
    });
    const toggleWatch = (matchId: string) => setUnticked(prev => {
        const next = new Set(prev);
        if (!next.delete(matchId)) next.add(matchId);
        return next;
    });
    const scoreOf = useCallback((cell: BracketCell) => liveScore(cell, scores[tileKey(cell)]), [scores]);

    const back = () => actions.openTournament(id);
    const header = !openId && (
        <header className="flex shrink-0 items-center gap-4 border-b-2 border-bay-plate bg-bay-panel px-4 py-1.5 phone:gap-2 phone:px-2 phone:py-1">
            <BackButton onBack={back} />
            {snapshot ? (
                <WatchStrip columns={bracketColumns(snapshot)} size={snapshot.tournament.size ?? 8} watched={new Set(ids)}
                    scoreOf={scoreOf} canWatchMore={watched.length < MAX_TILES} onToggle={toggleWatch} />
            ) : error ? <ErrorLine code={error.code} /> : <p className="m-0 text-[15px] text-bay-dust">{t('tournament.loading')}</p>}
        </header>
    );

    return (
        <div className="flex h-viewport flex-col overflow-hidden bg-bay-ink font-body text-bay-chalk">
            {header}
            <main data-testid="watch-tiles" {...(phone ? swipe : {})}
                className={`grid min-h-0 flex-1 gap-1 p-1 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${rows === 2 ? 'grid-rows-2' : 'grid-rows-1'}`}>
                {snapshot && shown.length === 0 && <Note>{t('tournament.watch.none')}</Note>}
                {shown.map(cell => {
                    const key = tileKey(cell);
                    const matchId = cell.match.id;
                    return (
                        <WatchTile key={tileStates.mountKey(key)} cell={cell} peerId={cell.match.hostPeerId ?? ''}
                            audible={matchId === soundId && !state.isMuted} expanded={matchId === openId}
                            status={statuses[key]} score={liveScore(cell, scores[key])}
                            onToggle={() => toggleExpand(matchId)}
                            onStatus={s => tileStates.setStatus(key, s)}
                            onScore={players => tileStates.setScore(key, players)} />
                    );
                })}
            </main>
        </div>
    );
};
