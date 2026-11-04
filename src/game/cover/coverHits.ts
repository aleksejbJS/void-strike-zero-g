// How weapons hurt cover: blasts, the railgun beam, the chainsaw and where a shot stops

import type { GameState, Vector2 } from '../../types';
import { WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { distance, segmentRectEntry } from '../utils/math';
import { COVER_EXPLOSIVE_MULT, COVER_SPECS, Cover } from './coverTypes';
import { coverRect, firstCoverOnSegment, intactCover } from './coverGeometry';
import { damageCover } from './coverDamage';

/** The chainsaw cuts a piece whose rect is this close (px) to the saw point. */
const CHAINSAW_COVER_REACH = 40;

/**
 * A blast hurts cover: the piece the projectile itself hit takes `damage × 3` (no falloff, wherever the impact point
 * is); other intact pieces inside the radius take `damage × 3 × (1 − distance / radius)` measured to the piece's
 * centre, unless a platform stands in the way. Cover does not shield cover. Every piece is hurt as by a blast,
 * so a barrel it breaks goes off after the chain delay.
 */
export const blastCover = (
    state: GameState, pos: Vector2, radius: number, damage: number, creditId: string, now: number, directCoverId?: string,
): void => {
    for (const cover of intactCover(state)) {
        if (cover.id === directCoverId) {
            damageCover(state, cover, damage * COVER_EXPLOSIVE_MULT, creditId, now, true);
            continue;
        }
        const rect = coverRect(cover);
        const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        const dist = distance(pos, centre);
        if (dist >= radius) continue;
        if (state.platforms.some(plat => segmentRectEntry(pos, centre, plat) !== null)) continue;
        damageCover(state, cover, damage * COVER_EXPLOSIVE_MULT * (1 - dist / radius), creditId, now, true);
    }
};

/**
 * The railgun beam origin → end, which a fighter or a platform already stops at fraction `closestT`. Returns where
 * it really stops: the nearest metal crate or barrel before that point ends it, wood and glass let it through.
 * Every piece it crosses up to the stop (the stopping one included) takes the railgun's damage.
 */
export const railThroughCover = (
    state: GameState, origin: Vector2, end: Vector2, closestT: number, shooterId: string, now: number,
): number => {
    const crossed: { cover: Cover; t: number }[] = [];
    for (const cover of intactCover(state)) {
        const t = segmentRectEntry(origin, end, coverRect(cover));
        if (t !== null && t < closestT) crossed.push({ cover, t });
    }
    crossed.sort((a, b) => a.t - b.t);
    const stopper = crossed.find(c => COVER_SPECS[c.cover.kind].stopsRail);
    const stopT = stopper ? stopper.t : closestT;
    for (const { cover, t } of crossed) {
        if (t > stopT) break;
        damageCover(state, cover, WEAPONS_DATA[WeaponType.RAILGUN].damage, shooterId, now);
    }
    return stopT;
};

/** One chainsaw tick at `attackPos` cuts every intact piece whose rect is within reach. */
export const chainsawCover = (state: GameState, attackPos: Vector2, shooterId: string, now: number): void => {
    for (const cover of intactCover(state)) {
        const r = coverRect(cover);
        const dx = Math.max(r.x - attackPos.x, 0, attackPos.x - (r.x + r.w));
        const dy = Math.max(r.y - attackPos.y, 0, attackPos.y - (r.y + r.h));
        if (Math.hypot(dx, dy) <= CHAINSAW_COVER_REACH) {
            damageCover(state, cover, WEAPONS_DATA[WeaponType.CHAINSAW].damage, shooterId, now);
        }
    }
};

/** The piece of cover a projectile flying from → to runs into, if it gets there before any platform (a tie goes to the platform). */
export const projectileCoverHit = (state: GameState, from: Vector2, to: Vector2): Cover | null => {
    const hit = firstCoverOnSegment(state, from, to);
    if (!hit) return null;
    for (const plat of state.platforms) {
        const t = segmentRectEntry(from, to, plat);
        if (t !== null && t <= hit.t) return null;
    }
    return hit.cover;
};
