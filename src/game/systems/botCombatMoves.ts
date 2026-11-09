// Moving in a fight: strafe bursts instead of standing still, a jetpack hop after a hit,
// crouching behind a crate when under fire (briefly, and not while busy with something more
// urgent), and when nearly dead, a hook (or jetpack) escape to another surface away from the enemy.

import { Entity, GameState, Team, WeaponType } from '../../types';
import { HIT_MIN_HP } from '../../constants';
import { distance } from '../utils/math';
import { NavGraph, NavNode } from './botNavGraph';
import { nodeAt } from './botPathfinder';
import { BotControls, BotMoves, BotNav } from './botNavState';
import { takeEdge, zoneFilter } from './botRoute';
import { findCoverSpot } from './botCover';
import { hasFlamethrower } from './botWeapons';
import { BOT_FLAME_PREFERRED_RANGE } from './flameConstants';
import type { BotState } from './botMemory';

const DODGE_MS = 220, DODGE_COOLDOWN_MS = 2500;
const ESCAPE_HEALTH = 0.3, ESCAPE_RANGE = 350, ESCAPE_COOLDOWN_MS = 8000, ESCAPE_LOCK_MS = 3000;
const EDGE_MARGIN = 40;
const UNDER_FIRE_MS = 1500, AT_SPOT_X = 6;
const COVER_STAY_MS = 2500, COVER_COOLDOWN_MS = 3000;
// Goals that matter more than hiding: carrying or chasing an objective, escorting, a medkit or the zone
const NO_COVER_STATES: ReadonlySet<BotState> = new Set(['flag-run', 'defend', 'retreat']);

/** How close the bot wants to get to its enemy. With a flamethrower it walks in whatever it holds
 *  (pickBestWeapon swaps to the flamethrower once the enemy is inside its reach). */
export const preferredRange = (bot: Entity) => {
    if (bot.weapon.type === WeaponType.SHOTGUN || bot.weapon.type === WeaponType.CHAINSAW) return 120;
    return hasFlamethrower(bot) ? BOT_FLAME_PREFERRED_RANGE : 320;
};

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
    // A flamethrower bot is meant to be up close: only a real hit sends it behind a crate, not the distance
    const inRange = targetVisible && !hasFlamethrower(bot) && distance(bot.pos, target.pos) < preferredRange(bot);
    const underFire = now - moves.lastHitAt < UNDER_FIRE_MS || inRange;
    if (!underFire || !here) return null;
    const spot = findCoverSpot(state, bot, target);
    if (!spot || spot.y !== here.y || spot.x < here.x0 || spot.x > here.x1) return null; // on another surface
    const dx = spot.x - bot.pos.x;
    return Math.abs(dx) > AT_SPOT_X ? { inputX: Math.sign(dx), wantsDown: false } : { inputX: 0, wantsDown: true };
};

/** Cover when free to take it, for at most COVER_STAY_MS at a time (then a cooldown, so a bot under
 *  steady fire still moves on). Never while busy: an urgent goal, a wound to heal, an escape move. */
const coverMove = (
    state: GameState, bot: Entity, here: NavNode | null, nav: BotNav, moves: BotMoves,
    target: Entity, targetVisible: boolean, botState: BotState, now: number,
) => {
    const busy = NO_COVER_STATES.has(botState) || !!bot.wound || now < nav.lockedUntil;
    const cover = busy || now < moves.coverReadyAt ? null : takeCover(state, bot, here, moves, target, targetVisible, now);
    if (!cover) { moves.coverSince = null; return null; }
    moves.coverSince ??= now;
    if (now - moves.coverSince < COVER_STAY_MS) return cover;
    moves.coverSince = null;
    moves.coverReadyAt = now + COVER_COOLDOWN_MS;
    return null;
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
    target: Entity | null, targetVisible: boolean, controls: BotControls, now: number, botState: BotState,
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
    const cover = coverMove(state, bot, here, nav, moves, target, targetVisible, botState, now);
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
