// Online, a projectile reaches this browser a snapshot or two after it was fired, already well
// past the gun (and other fighters are drawn 100 ms in the past on top of that). So each new
// projectile is drawn from its shooter's gun as seen on this screen and catches up with its real
// position over a few ticks. Purely visual: the server still decides every hit.

import { Entity, Projectile, Vector2 } from '../../types';
import { shotOrigin } from '../systems/combat';
import { moveProjectile } from '../systems/physics';

export const CATCH_UP_TICKS = 12; // 0.1 s at 120 ticks/s
// Further from the gun than this, the projectile was not just fired (e.g. it was in flight when we joined)
const MAX_GAP = 400;

interface Track {
    gap: Vector2;      // shooter's gun minus the projectile's real position, when first seen
    ticks: number;     // ticks since first seen
    drawn: Projectile; // the object the offset was last written into
    applied: Vector2;  // offset currently added to drawn.pos
}

export class ProjectileCatchUp {
    private readonly tracks = new Map<string, Track>();

    /** One client tick: move every projectile, drawing new ones pulled back toward their shooter's gun. */
    advance(projectiles: readonly Projectile[], players: readonly Entity[]) {
        const live = new Set<string>();
        for (const proj of projectiles) {
            live.add(proj.id);
            let track = this.tracks.get(proj.id);
            // Same object as last tick: take the offset back out so the real flight carries on.
            // A snapshot brings a new object that already holds the real position.
            if (track?.drawn === proj) {
                proj.pos.x -= track.applied.x;
                proj.pos.y -= track.applied.y;
            }
            if (!track) {
                track = { gap: gapToGun(proj, players), ticks: 0, drawn: proj, applied: { x: 0, y: 0 } };
                this.tracks.set(proj.id, track);
            }
            moveProjectile(proj);

            track.ticks++;
            const k = Math.max(0, 1 - track.ticks / CATCH_UP_TICKS);
            track.applied = { x: track.gap.x * k, y: track.gap.y * k };
            track.drawn = proj;
            proj.pos.x += track.applied.x;
            proj.pos.y += track.applied.y;
        }
        for (const id of this.tracks.keys()) {
            if (!live.has(id)) this.tracks.delete(id);
        }
    }
}

const gapToGun = (proj: Projectile, players: readonly Entity[]): Vector2 => {
    const shooter = players.find(p => p.id === proj.ownerId);
    if (!shooter || shooter.dead) return { x: 0, y: 0 };
    const gun = shotOrigin(shooter);
    const gap = { x: gun.x - proj.pos.x, y: gun.y - proj.pos.y };
    return Math.hypot(gap.x, gap.y) > MAX_GAP ? { x: 0, y: 0 } : gap;
};
