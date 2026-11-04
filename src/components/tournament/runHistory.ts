// What this page session did with its tournament duels. Kept in memory on purpose: a reload is a new session.
// - started: runs useMyTurn already started (never started twice; see useMyTurn's run keys).
// - no-shows: matches whose host this guest could not join within the deadline, per host peer id. The guest
//   counts as absent there (no heartbeat), so the host wins by the stale rule; a NEW peer id (the host reopened
//   the room) is a fresh chance to join.

const started = new Set<string>();
const noShows = new Set<string>();

const noShowKey = (matchId: string, peerId: string) => `${matchId}:${peerId}`;

export const wasStarted = (runKey: string): boolean => started.has(runKey);

export const markStarted = (runKey: string): void => {
    started.add(runKey);
};

export const markNoShow = (matchId: string, peerId: string): void => {
    noShows.add(noShowKey(matchId, peerId));
};

export const isNoShow = (matchId: string, peerId: string | null): boolean =>
    peerId !== null && noShows.has(noShowKey(matchId, peerId));

/** Test helper: a fresh page session. */
export const forgetRunHistory = (): void => {
    started.clear();
    noShows.clear();
};
