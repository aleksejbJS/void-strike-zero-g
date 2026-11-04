// Cover on the wire: the layout travels once (JoinAccepted/WatchAccepted), after that
// snapshots carry only what changes. The client never runs tickCover; it just mirrors this.

import { isKnownCoverKind } from './coverTypes';
import type { Cover, CoverStatus } from './coverTypes';

/** The host's layout without pieces of a kind this build does not know (a newer host): with no spec
 *  to size or draw them, they would crash the client. They are left out, with a warning. */
export const knownCover = (cover: readonly Cover[] | undefined): Cover[] => {
    const known = (cover ?? []).filter(c => isKnownCoverKind(c.kind));
    if (known.length < (cover?.length ?? 0)) {
        const unknown = new Set(cover!.filter(c => !isKnownCoverKind(c.kind)).map(c => c.kind));
        console.warn(`Cover of unknown kind left out (host on a newer build?): ${[...unknown].join(', ')}`);
    }
    return known;
};

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
