// What the projectile view remembers between frames, kept free of Pixi so it can be tested.
// The simulation stores no history, so the last few positions of each projectile are noted
// here (the plasma ghost orbs draw them) and forgotten the moment the projectile is gone.

import { PHYSICS_TICK_RATE, PROJECTILE_MAX_LIFE } from '../../../constants';
import { Projectile, Vector2, WeaponType } from '../../../types';

const TRAIL_LENGTH = 7;
const GRENADE_LIFE = 60; // ticks, as spawned in combat.ts (grenade and smoke rounds)

export class ProjectileMemory {
    private readonly trails = new Map<string, Vector2[]>();
    private readonly firstSeenMs = new Map<string, number>();

    /** Note where a projectile is now. Standing still since the last call (no physics tick) adds nothing. */
    remember(id: string, pos: Vector2): void {
        let trail = this.trails.get(id);
        if (!trail) {
            trail = [];
            this.trails.set(id, trail);
        }
        const newest = trail[0];
        if (newest && newest.x === pos.x && newest.y === pos.y) return;
        // Reuse the point that falls off the end; copying also keeps the sim's mutable vector out of the history
        const spot = trail.length >= TRAIL_LENGTH ? trail.pop()! : { x: 0, y: 0 };
        spot.x = pos.x;
        spot.y = pos.y;
        trail.unshift(spot);
    }

    /** Remembered positions, newest first, at most 7. Read-only: the array is the memory itself. */
    trail(id: string): readonly Vector2[] {
        return this.trails.get(id) ?? [];
    }

    /**
     * Ticks of wall-clock time since this id was first asked about (0 on the first call).
     * Animations run on this rather than on the projectile's `life`: online, `life` only
     * changes when a snapshot arrives, which would make a spin or pulse jump per snapshot.
     */
    ageTicks(id: string, nowMs: number): number {
        let first = this.firstSeenMs.get(id);
        if (first === undefined) {
            first = nowMs;
            this.firstSeenMs.set(id, first);
        }
        return ((nowMs - first) * PHYSICS_TICK_RATE) / 1000;
    }

    /** Drop every id that is not in `live`. */
    forgetMissing(live: ReadonlySet<string>): void {
        for (const id of this.trails.keys()) {
            if (!live.has(id)) this.trails.delete(id);
        }
        for (const id of this.firstSeenMs.keys()) {
            if (!live.has(id)) this.firstSeenMs.delete(id);
        }
    }

    get size(): number {
        return this.trails.size;
    }
}

/** The simulation's age of a projectile in ticks, from the life it has left. The view animates by ProjectileMemory.ageTicks instead. */
export const projectileAge = (p: Projectile): number => {
    const total = p.type === WeaponType.GRENADE_LAUNCHER || p.type === WeaponType.SMOKE_LAUNCHER ? GRENADE_LIFE : PROJECTILE_MAX_LIFE;
    return total - (p.life ?? PROJECTILE_MAX_LIFE);
};

/** One shotgun pellet per shooter: the spot where that shot's muzzle puff belongs. */
export const firstPelletPerOwner = (fresh: readonly Projectile[]): Projectile[] => {
    const seen = new Set<string>();
    const first: Projectile[] = [];
    for (const p of fresh) {
        if (p.type !== WeaponType.SHOTGUN || seen.has(p.ownerId)) continue;
        seen.add(p.ownerId);
        first.push(p);
    }
    return first;
};
