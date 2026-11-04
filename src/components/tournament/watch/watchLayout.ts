// Pure view logic of the watch screen: which live matches get a tile, how the tiles are laid out,
// which tile plays sound, and how far a phone swipe must go.

import { bracketColumns, type BracketCell } from '../../../game/tournament/bracketView';
import type { TournamentSnapshot } from '../../../tournament/types';

export type WatchLayout = { cols: 1 | 2; rows: 1 | 2 };

/** Each tile is its own Pixi application (WebGL context) and spectator link: never more than this. */
export const MAX_TILES = 4;
/** A phone swipe must travel further than this to switch matches. */
export const SWIPE_MIN_PX = 60;

/** 1 tile fills the screen, 2 sit side by side, 3–4 make a 2×2 grid; a phone always shows one. */
export const layoutFor = (tiles: number, phone: boolean): WatchLayout => {
    if (phone || tiles <= 1) return { cols: 1, rows: 1 };
    return tiles === 2 ? { cols: 2, rows: 1 } : { cols: 2, rows: 2 };
};

/** The matches spectators can watch right now, in bracket order (round, then slot). */
export const liveCells = (s: TournamentSnapshot): BracketCell[] => bracketColumns(s).flat().filter(c => c.live);

/** Every live match except the ones unticked in the strip, at most MAX_TILES. */
export const watchedCells = (live: readonly BracketCell[], unticked: ReadonlySet<string>): BracketCell[] =>
    live.filter(c => !unticked.has(c.match.id)).slice(0, MAX_TILES);

/** The one tile with sound: the expanded one, else the last clicked, else the first. Gone tiles do not count. */
export const audibleTile = (watched: readonly string[], expanded: string | null, lastClicked: string | null): string | null => {
    if (expanded !== null && watched.includes(expanded)) return expanded;
    if (lastClicked !== null && watched.includes(lastClicked)) return lastClicked;
    return watched[0] ?? null;
};

/** A horizontal swipe of more than SWIPE_MIN_PX: to the left goes to the next match (+1), to the right back (-1). */
export const swipeStep = (dx: number): -1 | 0 | 1 => {
    if (dx < -SWIPE_MIN_PX) return 1;
    if (dx > SWIPE_MIN_PX) return -1;
    return 0;
};
