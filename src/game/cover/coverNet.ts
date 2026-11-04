// Cover on the wire: the layout travels once (JoinAccepted/WatchAccepted), after that
// snapshots carry only what changes. The client never runs tickCover; it just mirrors this.

import type { Cover, CoverStatus } from './coverTypes';

/** What a snapshot says about each piece: hp and (while it is gone) when it returns. Fuses and credit stay on the server. */
export const coverStatusOf = (cover: readonly Cover[]): CoverStatus[] =>
    cover.map(c => (c.returnsAt === undefined ? { id: c.id, hp: c.hp } : { id: c.id, hp: c.hp, returnsAt: c.returnsAt }));

/** Write a snapshot's status onto the local pieces by id. Unknown ids are ignored; no status (an older host) leaves everything as it is. */
export const applyCoverStatus = (cover: Cover[], status: readonly CoverStatus[] | undefined): void => {
    if (!status) return;
    const byId = new Map(cover.map(c => [c.id, c]));
    for (const s of status) {
        const piece = byId.get(s.id);
        if (!piece) continue;
        piece.hp = s.hp;
        piece.returnsAt = s.returnsAt;
    }
};
