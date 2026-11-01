// Roaming with no enemy in sight: wander between random surfaces of the navigation graph
// (works on every map, no hand-placed waypoints).

import { Entity, GameState, Vector2 } from '../../types';
import { NavGraph } from './botNavGraph';
import { findPath, nodeAt } from './botPathfinder';
import { BotNav } from './botNavState';
import { zoneFilter } from './botRoute';

const MIN_WIDTH = 60;
const TRIES = 6;
const PICK_EVERY_MS = 1000; // at most this often (a pick runs a few path searches)

const centre = (graph: NavGraph, id: number): Vector2 => {
    const n = graph.nodes[id];
    return { x: (n.x0 + n.x1) / 2, y: n.y };
};

/** A random surface the bot can actually get to from where it stands (-1 if none found). */
const pickRoamNode = (state: GameState, graph: NavGraph, here: number) => {
    const allowed = zoneFilter(state);
    const options = graph.nodes.filter(n => n.id !== here && n.x1 - n.x0 >= MIN_WIDTH && (!allowed || allowed(n)));
    for (let i = 0; i < TRIES && options.length; i++) {
        const n = options[Math.floor(Math.random() * options.length)];
        const path = findPath(graph, { from: here, goal: centre(graph, n.id), allowed });
        if (path.at(-1)?.to === n.id) return n.id;
    }
    return -1;
};

export const roamGoal = (state: GameState, bot: Entity, nav: BotNav, graph: NavGraph, now: number): Vector2 => {
    const here = bot.isGrounded ? nodeAt(graph, bot.pos) : null;
    const arrived = here && (here.id === nav.roamNode || (nav.goalNode === nav.roamNode && nav.path.length === 0));
    const invalid = nav.roamNode < 0 || nav.roamNode >= graph.nodes.length;
    if (here && (arrived || invalid) && now >= nav.roamPickAt) {
        nav.roamNode = pickRoamNode(state, graph, here.id);
        nav.roamPickAt = now + PICK_EVERY_MS;
    }
    return nav.roamNode >= 0 ? centre(graph, nav.roamNode) : bot.pos;
};
