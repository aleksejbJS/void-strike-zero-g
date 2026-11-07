// The fuel tank's fuse and blast (spec 2026-11-07-flamethrower, section 4): a lit tank blows up TANK_FUSE_MS after it
// caught fire, on its living carrier's back or, if the carrier died first, where they died. fuelTank.ts decides ignition.
// combat.ts and this file import each other: only use the other's exports inside functions, never at load time.

import type { Entity, GameState, LitTank, Vector2 } from '../../types';
import { nextId } from '../utils/id';
import { gameEvents } from './events';
import { applyDamage } from './combat';
import { createExplosion } from './explosion';
import { TANK_DAMAGE, TANK_RADIUS } from './flameConstants';

/** Where the tank sits: on the fighter's back, a bit above the middle of the body. */
export const tankPos = (p: Entity): Vector2 => ({
    x: p.pos.x - (p.facingRight ? 10 : -10),
    y: p.pos.y - p.height * 0.6,
});

const clearFuse = (p: Entity): void => {
    p.tankFuseAt = undefined;
    p.tankBy = undefined;
};

/**
 * A fighter is dying: if their tank is lit, it stays behind as a world object at their back (the corpse is a client-side
 * ragdoll and the fighter itself respawns) with the same fuse and igniter, and the fighter no longer carries it.
 * Returns the lit tank's id, or undefined when the tank was not lit.
 */
export const dropLitTank = (state: GameState, p: Entity): string | undefined => {
    if (p.tankFuseAt === undefined) return undefined;
    const tank: LitTank = { id: nextId('tank_'), pos: tankPos(p), fuseAt: p.tankFuseAt, by: p.tankBy ?? '' };
    (state.litTanks ?? (state.litTanks = [])).push(tank);
    clearFuse(p);
    return tank.id;
};

/** The barrel-style blast: hurts everyone in reach, the igniter and their teammates too, credited to the igniter. */
const blast = (state: GameState, pos: Vector2, by: string, carrierId: string | undefined, now: number): void =>
    createExplosion(state, pos, by, TANK_RADIUS, undefined, carrierId, { tank: true, damage: TANK_DAMAGE, now });

/**
 * Run once per physics tick: every due tank blows up. A living carrier always dies and is always gibbed, whatever their
 * health and armor; a dead carrier's tank (dropLitTank) goes off where they died and tells clients to gib the corpse.
 * Paused once the Hunger round is decided, like burning and bleeding: the round reset clears every lit tank.
 */
export const tickFuelTanks = (state: GameState, now: number): void => {
    if (state.hungerRoundEndsAt) return;
    for (const p of state.players) {
        if (p.dead || p.tankFuseAt === undefined || p.tankFuseAt > now) continue;
        const by = p.tankBy ?? '';
        const pos = tankPos(p);
        clearFuse(p); // first: the death must not drop this tank again
        applyDamage(state, p, by, 9999, { x: 0, y: 0 }, 0, { tank: true, direct: true, from: pos });
        blast(state, pos, by, p.id, now);
    }
    const tanks = state.litTanks ?? [];
    const due = tanks.filter(t => t.fuseAt <= now);
    if (due.length === 0) return;
    state.litTanks = tanks.filter(t => t.fuseAt > now);
    for (const t of due) {
        gameEvents.emit({ type: 'TANK_BLAST', id: t.id, x: t.pos.x, y: t.pos.y });
        blast(state, t.pos, t.by, undefined, now);
    }
};
