// The forward flip of the double jump (spec 2026-11-19-jump), read from what is drawn: the simulation only
// marks the air jump of this airtime as used (`airJump` ±1, the direction). Each client turns its picture of
// the fighter once when it sees that mark appear, so the local, remote and spectated fighters all flip.

export const FLIP_MS = 400;

export class FighterFlip {
    private seen = false;
    private last = 0;          // airJump at the previous look (0 = available)
    private startedAt: number | null = null;
    private dir = 1;

    /** Rotation of the fighter picture in radians: 0 when not flipping. */
    observe(airJump: number | undefined, nowMs: number): number {
        const now = airJump ? Math.sign(airJump) : 0;
        // A mark seen on the very first look was set before this fighter came into view: no flip from nowhere
        if (this.seen && this.last === 0 && now !== 0) { this.startedAt = nowMs; this.dir = now; }
        if (now === 0) this.startedAt = null; // landed: upright at once
        this.seen = true;
        this.last = now;
        if (this.startedAt === null) return 0;
        const t = nowMs - this.startedAt;
        if (t < 0 || t >= FLIP_MS) return 0;
        return this.dir * 2 * Math.PI * (t / FLIP_MS);
    }
}
