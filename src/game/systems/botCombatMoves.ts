// Moving in a fight: strafe bursts instead of standing still, a jetpack hop after a hit,
// and when nearly dead, a hook (or jetpack) escape to another surface away from the enemy.

import { Entity, GameState, Team, WeaponType } from '../../types';
import { HIT_MIN_HP } from '../../constants';
import { distance } from '../utils/math';
import { NavGraph, NavNode } from './botNavGraph';
import { nodeAt } from './botPathfinder';
import { BotControls, BotMoves, BotNav } from './botNavState';
import { takeEdge, zoneFilter } from './botRoute';

const DODGE_MS = 220, DODGE_COOLDOWN_MS = 2500;
const ESCAPE_HEALTH = 0.3, ESCAPE_RANGE = 350, ESCAPE_COOLDOWN_MS = 8000, ESCAPE_LOCK_MS = 3000;
const EDGE_MARGIN = 40;

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
    // A flag carrier just runs for home: no hops, no detours
    if (!target || !targetVisible || bot.grapple.active || bot.hasFlag !== Team.NONE) return controls;
    const here = bot.isGrounded ? nodeAt(graph, bot.pos) : null;

    // Nearly dead and the enemy is close: get off this surface. Not when wounded: it is always nearly
    // dead and its way to a medkit (botGoals) matters more than getting away
    const dying = !bot.wound && bot.health < bot.maxHealth * ESCAPE_HEALTH && distance(bot.pos, target.pos) < ESCAPE_RANGE;
    if (dying && here && now >= moves.escapeReadyAt) {
        const edge = escapeRoute(state, graph, here, bot, target);
        if (edge) {
            takeEdge(nav, edge, ESCAPE_LOCK_MS, now);
            moves.escapeReadyAt = now + ESCAPE_COOLDOWN_MS;
            return controls;
        }
    }

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
