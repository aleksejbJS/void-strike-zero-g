// Keeps a bot's route up to date: plans on the navigation graph, notices when an edge is
// done, and marks edges that keep failing as blocked so the next plan goes around them.

import { Entity, GameMode, GameState, Vector2 } from '../../types';
import { NavEdge, NavGraph, NavNode } from './botNavGraph';
import { edgeKey, findPath, goalNode, nodeAt } from './botPathfinder';
import { BotNav, newBotNav } from './botNavState';

const REPLAN_MS = 500;
const BLOCK_MS = 6000;
const RESPAWN_GAP_MS = 500;
const WOUNDED_WALK_PX_S = 60; // a one-legged hop (PRONE_SPEED): long walks are not worth it, flying is
const ENGAGE_RANGE = 30; // px from the take-off point that count as "started the move"
// How long a move may take once started, before it counts as failed
const EDGE_LIMIT_MS: Record<NavEdge['kind'], number> = { walk: 2500, drop: 3000, jet: 5000, hook: 7000 };

/** Hunger Games: only surfaces inside the zone. */
export const zoneFilter = (state: GameState) => {
    const hz = state.mode === GameMode.HUNGER_GAMES ? state.hungerZone : undefined;
    if (!hz) return undefined;
    return (n: NavNode) => n.x1 > hz.x + 20 && n.x0 < hz.x + hz.w - 20 && n.y > hz.y && n.y < hz.y + hz.h;
};

export const blockEdge = (nav: BotNav, e: NavEdge, now: number) => {
    nav.blocked.set(edgeKey(e), now + BLOCK_MS);
    nav.path = [];
    nav.replanAt = 0;
    nav.lockedUntil = 0;
};

/** Take this one edge now (an escape move), with no re-planning for `lockMs`. */
export const takeEdge = (nav: BotNav, e: NavEdge, lockMs: number, now: number) => {
    nav.path = [e];
    nav.lockedUntil = now + lockMs;
    startEdge(nav);
};

const startEdge = (nav: BotNav) => {
    const key = nav.path[0] ? edgeKey(nav.path[0]) : '';
    if (key === nav.edgeKey) return;
    nav.edgeKey = key;
    nav.engagedAt = 0;
    nav.hookFiredAt = 0;
    nav.hookReleased = false;
};

const activeBlocks = (nav: BotNav, now: number) => {
    for (const [key, until] of nav.blocked) if (until <= now) nav.blocked.delete(key);
    return nav.blocked;
};

/** Plan when due, advance past finished edges, give up on edges that take too long. */
export const updateRoute = (state: GameState, bot: Entity, nav: BotNav, graph: NavGraph, goal: Vector2, now: number) => {
    // A new map, or back from the dead somewhere else: start over
    if (nav.graph !== graph || now - nav.seenAt > RESPAWN_GAP_MS) Object.assign(nav, newBotNav(), { graph, blocked: nav.blocked });
    nav.seenAt = now;
    const here = bot.isGrounded ? nodeAt(graph, bot.pos) : null;

    // Landed where the current edge leads: on to the next one
    if (here && nav.path[0]?.to === here.id) { nav.path.shift(); startEdge(nav); }

    // Mid-move (in the air or on the rope) the bot keeps its edge; it re-plans only on the ground
    const busy = !here || bot.grapple.active;
    const target = goalNode(graph, goal)?.id ?? -1;
    const offRoute = nav.path.length > 0 && here !== null && here.id !== nav.path[0].from;
    const due = now >= nav.replanAt || target !== nav.goalNode || offRoute;
    if (!busy && due && (now >= nav.lockedUntil || offRoute)) {
        nav.path = findPath(graph, { from: here.id, fromX: bot.pos.x, goal, allowed: zoneFilter(state), blocked: activeBlocks(nav, now), walkPxPerS: bot.wound ? WOUNDED_WALK_PX_S : undefined });
        nav.goalNode = target;
        nav.replanAt = now + REPLAN_MS;
        startEdge(nav);
    }

    const edge = nav.path[0];
    if (!edge) return;
    if (!nav.engagedAt && (!bot.isGrounded || Math.abs(bot.pos.x - edge.startX) <= ENGAGE_RANGE)) nav.engagedAt = now;
    if (nav.engagedAt && now - nav.engagedAt > EDGE_LIMIT_MS[edge.kind]) blockEdge(nav, edge, now);
};
