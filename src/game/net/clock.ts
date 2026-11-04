// Server clock -> this machine's clock for snapshot timestamps.

import { Snapshot } from './protocol';

// Timestamps at or above this mean "never" (e.g. no respawn in Hunger Games)
export const NEVER = Number.MAX_SAFE_INTEGER / 2;

/**
 * Server timestamps → this machine's clock (machines' clocks differ), so countdowns
 * for respawn, zone shrink, round restart and Infiltration show the right time.
 */
export const toLocalClock = (snap: Snapshot, offset: number) => {
    const shift = (t: number | undefined) => (t === undefined || t >= NEVER || t <= 0 ? t : t + offset);
    snap.hungerRoundEndsAt = shift(snap.hungerRoundEndsAt);
    snap.hungerRoundStartedAt = shift(snap.hungerRoundStartedAt);
    snap.matchStartedAt = shift(snap.matchStartedAt);
    snap.matchEndsAt = shift(snap.matchEndsAt);
    snap.infiltrationEndTime = shift(snap.infiltrationEndTime);
    snap.lastHTFScore = shift(snap.lastHTFScore);
    if (snap.hungerZone) {
        snap.hungerZone.nextShrinkAt = shift(snap.hungerZone.nextShrinkAt);
        snap.hungerZone.lastShrink = shift(snap.hungerZone.lastShrink);
    }
    for (const p of snap.players) {
        p.respawnTimer = shift(p.respawnTimer) ?? 0;
        p.spawnShieldUntil = shift(p.spawnShieldUntil);
    }
    // New objects: the host's own cloud list must keep its own clock
    if (snap.smokes) snap.smokes = snap.smokes.map(c => ({ ...c, bornAt: c.bornAt + offset, endsAt: c.endsAt + offset }));
    if (snap.coverStatus) snap.coverStatus = snap.coverStatus.map(c => (c.returnsAt === undefined ? c : { ...c, returnsAt: shift(c.returnsAt) }));
};
