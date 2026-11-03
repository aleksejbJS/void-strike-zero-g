// Where a bot chases a fighter: the real position while smoke does not hide them, otherwise
// the spot where it last saw them; once there, it looks around that spot for a while.
// Walls do not hide a position.

import { Entity, GameState, Vector2 } from '../../types';
import { distance } from '../utils/math';
import { BotMemory } from './botMemory';
import { centerOf, muzzleOf } from './botSenses';
import { SMOKE_DURATION_MS, smokeHides } from './smoke';
import { NavGraph, NavNode } from './botNavGraph';
import { nodeAt } from './botPathfinder';
import { centre, pickRoamNode } from './botRoam';

export const SEARCH_REACHED = 48;     // px: this close to the last-seen spot, it has been reached
export const SEARCH_AROUND_MS = 3000; // then look around it this long before roaming the map
export const SEARCH_RADIUS = 300;     // px: surfaces this close to the spot are searched
const SEARCH_PICK_EVERY_MS = 500;     // at most this often (a pick runs a few path searches)

const forget = (mem: BotMemory, id: string) => {
    mem.lastSeen.delete(id);
    mem.seenAt.delete(id);
};

/** A spot is stale once older than a smoke cloud lives or from an earlier life of the fighter.
 *  (A spot always gets a stamp when recorded; one without counts as fresh.) */
const isStale = (mem: BotMemory, fighter: Entity | undefined, now: number) => {
    if (!fighter || fighter.dead) return true;
    const stamp = mem.seenAt.get(fighter.id);
    return !!stamp && (now - stamp.at > SMOKE_DURATION_MS || stamp.life !== fighter.respawnTimer);
};

/** Drops the last-seen spots of fighters that died, left or were seen too long ago. */
export const forgetStale = (state: GameState, mem: BotMemory, now: number) => {
    for (const id of [...mem.lastSeen.keys()]) {
        if (isStale(mem, state.players.find(p => p.id === id), now)) forget(mem, id);
    }
};

/** Where the bot believes `target` is: the real position (remembered) while smoke does not hide
 *  them, otherwise the last-seen spot, or null if it has none (or only a stale one). */
export const knownPos = (state: GameState, bot: Entity, mem: BotMemory, target: Entity, now = Date.now()): Vector2 | null => {
    if (target.dead) { forget(mem, target.id); return null; }
    if (!smokeHides(state, muzzleOf(bot), centerOf(target), now)) {
        mem.lastSeen.set(target.id, { ...target.pos });
        mem.seenAt.set(target.id, { at: now, life: target.respawnTimer });
        return target.pos;
    }
    if (isStale(mem, target, now)) { forget(mem, target.id); return null; }
    return mem.lastSeen.get(target.id) ?? null;
};

/** The point to chase `target` at, or null when smoke hides them and there is no lead left.
 *  Reaching the last-seen spot starts a search around it (`searchGoal`). */
export const chasePoint = (state: GameState, bot: Entity, mem: BotMemory, target: Entity, now = Date.now()): Vector2 | null => {
    const spot = knownPos(state, bot, mem, target, now);
    if (!spot || spot === target.pos || distance(bot.pos, spot) > SEARCH_REACHED) return spot;
    forget(mem, target.id); // reached: nothing left to go on but the area around it
    mem.search = { spot: { ...spot }, until: now + SEARCH_AROUND_MS, point: null, pickAt: 0 };
    return null;
};

/** The next point to look at: another surface near the spot the bot can get to,
 *  else somewhere near the spot along the surface it stands on. */
const pickSearchPoint = (state: GameState, graph: NavGraph, here: NavNode, spot: Vector2): Vector2 => {
    const node = pickRoamNode(state, graph, here.id, n => distance(centre(graph, n.id), spot) <= SEARCH_RADIUS);
    if (node >= 0) return centre(graph, node);
    const x = spot.x + (Math.random() * 2 - 1) * SEARCH_RADIUS;
    return { x: Math.min(here.x1, Math.max(here.x0, x)), y: here.y };
};

/** While searching: a point near the reached spot to go to; null once the search is over. */
export const searchGoal = (state: GameState, bot: Entity, mem: BotMemory, graph: NavGraph, now: number): Vector2 | null => {
    const s = mem.search;
    if (!s || now >= s.until) { mem.search = null; return null; }
    const here = bot.isGrounded ? nodeAt(graph, bot.pos) : null;
    const arrived = !s.point || distance(bot.pos, s.point) <= SEARCH_REACHED;
    if (here && arrived && now >= s.pickAt) {
        s.point = pickSearchPoint(state, graph, here, s.spot);
        s.pickAt = now + SEARCH_PICK_EVERY_MS;
    }
    return s.point ?? s.spot;
};
