// Moving in a fight: strafe bursts instead of standing still, a jetpack hop after a hit,
// crouching behind a crate when under fire, and when nearly dead, a hook (or jetpack)
// escape to another surface away from the enemy.

import { Entity, GameState, Team, WeaponType } from '../../types';
import { HIT_MIN_HP } from '../../constants';
import { distance } from '../utils/math';
import { NavGraph, NavNode } from './botNavGraph';
import { nodeAt } from './botPathfinder';
import { BotControls, BotMoves, BotNav } from './botNavState';
import { takeEdge, zoneFilter } from './botRoute';
import { findCoverSpot } from './botCover';

const DODGE_MS = 220, DODGE_COOLDOWN_MS = 2500;
const ESCAPE_HEALTH = 0.3, ESCAPE_RANGE = 350, ESCAPE_COOLDOWN_MS = 8000, ESCAPE_LOCK_MS = 3000;
const EDGE_MARGIN = 40;
const UNDER_FIRE_MS = 1500, AT_SPOT_X = 6;

export const preferredRange = (bot: Entity) =>
    bot.weapon.type === WeaponType.SHOTGUN || bot.weapon.type === WeaponType.CHAINSAW ? 120 : 320;

/** Strafe direction for the next burst: mostly sideways, backing off when too close, never off the surface. */
const strafe = (bot: Entity, target: Entity, here: NavNode, moves: BotMoves, now: number) => {
    if (now >= moves.strafeUntil) {
        const tooClose = distance(bot.pos, target.pos) < preferredRange(bot) - 120;
        const away = -Math.sign(target.pos.x - bot.pos.x) || 1;
        const r = Math.random();
        moves.strafeDir = tooClose ? (r < 0.75 ? away : -away) : r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
        moves.strafeUntil = now + 250 + Math.random() * 400;
    }
    if (bot.pos.x + moves.strafeDir * EDGE_MARGIN < here.x0 || bot.pos.x + moves.strafeDir * EDGE_MARGIN > here.x1) moves.strafeDir *= -1;
    return moves.strafeDir;
};

/** Under fire (hit lately, or the target in sight and closer than the weapon's range): walk to the
 *  cover spot on this surface and crouch there (bot.ts stands it up to shoot). Null: no cover to use. */
const takeCover = (
    state: GameState, bot: Entity, here: NavNode | null, moves: BotMoves, target: Entity, targetVisible: boolean, now: number,
): Pick<BotControls, 'inputX' | 'wantsDown'> | null => {
    const underFire = now - moves.lastHitAt < UNDER_FIRE_MS || (targetVisible && distance(bot.pos, target.pos) < preferredRange(bot));
    if (!underFire || !here) return null;
    const spot = findCoverSpot(state, bot, target);
    if (!spot || spot.y !== here.y || spot.x < here.x0 || spot.x > here.x1) return null; // on another surface
    const dx = spot.x - bot.pos.x;
    return Math.abs(dx) > AT_SPOT_X ? { inputX: Math.sign(dx), wantsDown: false } : { inputX: 0, wantsDown: true };
};

/** An edge off this surface that leads away from the enemy: hook first, else jetpack. */
const escapeRoute = (state: GameState, graph: NavGraph, here: NavNode, bot: Entity, target: Entity) => {
    const allowed = zoneFilter(state);
    const away = (x: number) => Math.sign(x - bot.pos.x) === -Math.sign(target.pos.x - bot.pos.x);
    const options = graph.out[here.id].filter(e => (e.kind === 'hook' || e.kind === 'jet') && away(e.endX) && (!allowed || allowed(graph.nodes[e.to])));
    return options.find(e => e.kind === 'hook') ?? options[0];
};

export const combatMoves = (
    state: GameState, bot: Entity, nav: BotNav, moves: BotMoves, graph: NavGraph,
    target: Entity | null, targetVisible: boolean, controls: BotControls, now: number,
): BotControls => {
    // A drop smaller than HIT_MIN_HP is bleeding, not a hit: a wounded bot must not hop every few seconds
    const hit = moves.lastHealth - bot.health > HIT_MIN_HP;
    moves.lastHealth = bot.health;
    if (hit) moves.lastHitAt = now;
    // A flag carrier just runs for home: no hops, no detours
    if (!target || bot.grapple.active || bot.hasFlag !== Team.NONE) return controls;
    const here = bot.isGrounded ? nodeAt(graph, bot.pos) : null;

    // Nearly dead and the enemy is close: get off this surface. Not when wounded: it is always nearly
    // dead and its way to a medkit (botGoals) matters more than getting away
    const dying = targetVisible && !bot.wound && bot.health < bot.maxHealth * ESCAPE_HEALTH && distance(bot.pos, target.pos) < ESCAPE_RANGE;
    if (dying && here && now >= moves.escapeReadyAt) {
        const edge = escapeRoute(state, graph, here, bot, target);
        if (edge) {
            takeEdge(nav, edge, ESCAPE_LOCK_MS, now);
            moves.escapeReadyAt = now + ESCAPE_COOLDOWN_MS;
            return controls;
        }
    }

    // Under fire with a crate nearby: get behind it (no hop: crouching there is the dodge)
    const cover = takeCover(state, bot, here, moves, target, targetVisible, now);
    if (cover) return { ...controls, ...cover, isFlying: false };
    if (!targetVisible) return controls;

    // Just got hit: a short hop to throw off the enemy's aim
    if (hit && bot.isGrounded && now >= moves.dodgeReadyAt && bot.jetpackFuel > 30) {
        moves.dodgeUntil = now + DODGE_MS;
        moves.dodgeReadyAt = now + DODGE_COOLDOWN_MS;
    }
    if (now < moves.dodgeUntil) return { ...controls, isFlying: true, inputX: controls.inputX || moves.strafeDir };

    // Holding position (at the goal, not on a move): strafe instead of standing still
    if (nav.path.length === 0 && here && controls.inputX === 0 && !controls.isFlying) {
        return { ...controls, inputX: strafe(bot, target, here, moves, now) };
    }
    return controls;
};
