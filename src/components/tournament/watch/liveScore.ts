// The live score of a watched duel, from the players a tile reports (MatchTile.onScore), as [seat A, seat B].
// In-game names usually equal the seat nicknames; a logged-in player may play under another name, so an
// unknown name takes the seat left over, and with no known name at all the host (first player) is its seat.

import type { BracketCell } from '../../../game/tournament/bracketView';
import type { TileScore } from './MatchTile';

export const liveScore = (cell: BracketCell, players: readonly TileScore[] | undefined): [number, number] | null => {
    if (!players || players.length < 2) return null;
    const [p, q] = players;
    const nameA = cell.a?.nickname;
    const nameB = cell.b?.nickname;
    if (p.name === nameA || q.name === nameB) return [p.score, q.score];
    if (p.name === nameB || q.name === nameA) return [q.score, p.score];
    const hostIsA = cell.match.hostSeat === null || cell.match.hostSeat === cell.match.seatA;
    return hostIsA ? [p.score, q.score] : [q.score, p.score];
};
