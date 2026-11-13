// The flamethrower's stream: three short rays in a narrow cone that burn fighters and cover alike.
// Simulation only: it changes health and cover hp and announces a sound; how the flame looks is the client's job.

import { WeaponType } from '../../types';
import type { Entity, GameState, Vector2 } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { segmentRectEntry } from '../utils/math';
import type { Cover } from '../cover/coverTypes';
import { damageCover } from '../cover/coverDamage';
import { gameEvents } from './events';
import { applyDamage, isTeammate } from './combat';
import { igniteBurn } from './burning';
import { spawnShieldLeft } from './spawnShield';
import { hungerShieldLeft } from './hungerRound';
import { FLAME_COVER_MULT, FLAME_HALF_ANGLE, FLAME_RANGE } from './flameConstants';
import { rayStop } from './flameReach';
import { hitRect } from './hitZone';

/** The three rays: the aim line and one on each edge of the cone. */
const RAY_ANGLES = [-FLAME_HALF_ANGLE, 0, FLAME_HALF_ANGLE];

/**
 * One tick of the flame stream from `origin` along the unit vector `dir`. Every living enemy a ray enters takes the
 * stream's damage once, however many rays cross it; fighters do not stop the stream, platforms and cover do.
 * Every distinct piece of cover that stops a ray takes the damage times its kind's flame multiplier once.
 */
export const fireFlame = (state: GameState, p: Entity, origin: Vector2, dir: Vector2, now: number): void => {
    const stats = WEAPONS_DATA[WeaponType.FLAMETHROWER];
    const aim = Math.atan2(dir.y, dir.x);
    const victimIds = new Set<string>();
    const scorched = new Set<Cover>();

    for (const offset of RAY_ANGLES) {
        const end = {
            x: origin.x + Math.cos(aim + offset) * FLAME_RANGE,
            y: origin.y + Math.sin(aim + offset) * FLAME_RANGE,
        };
        const stop = rayStop(state, origin, end);
        if (stop.cover) scorched.add(stop.cover);
        for (const tgt of state.players) {
            if (tgt.id === p.id || tgt.dead || isTeammate(p, tgt)) continue;
            const t = segmentRectEntry(origin, end, hitRect(tgt)); // the drawn head counts too
            if (t !== null && t <= stop.t) victimIds.add(tgt.id);
        }
    }

    for (const tgt of state.players) {
        if (!victimIds.has(tgt.id)) continue;
        applyDamage(state, tgt, p.id, stats.damage, dir, stats.knockbackForce, { weapon: WeaponType.FLAMETHROWER, from: origin });
        // A hit that kills sets no fire (the dead are out); a shielded fighter took no hit, so it catches none either
        if (!tgt.dead && spawnShieldLeft(tgt, now) <= 0 && hungerShieldLeft(state, now) <= 0) igniteBurn(tgt, p.id, now);
    }
    for (const cover of scorched) {
        damageCover(state, cover, stats.damage * FLAME_COVER_MULT[cover.kind], p.id, now);
    }

    gameEvents.emit({ type: 'SOUND', sound: 'flame', subtype: 'spray' });
};
