// Turns the current edge of a bot's route into the controls a player would press:
// walk, drop off an edge, jetpack up, or grapple up (botHook.ts).

import { Entity, GameState, Vector2 } from '../../types';
import { HOP_RISE, JET_RISE, NavEdge, NavGraph, NavNode } from './botNavGraph';
import { nodeAt } from './botPathfinder';
import { BotControls, BotNav, IDLE } from './botNavState';
import { climbOnto, toward } from './botClimb';
import { hookMove } from './botHook';

const AT_X = 12;
const ARRIVE_X = 30;
const REACH_UP = 50; // a goal higher than this above the surface can't be reached standing
const HOP_FUEL = 80; // a hop up to HOP_RISE needs most of the tank

/** Fuel needed before taking off for a climb of `dy` px (the tank refills in about a second). */
const fuelFor = (bot: Entity, dy: number) => Math.min(bot.maxFuel * 0.95, 20 + (dy / JET_RISE) * 85);

const jetMove = (state: GameState, bot: Entity, nav: BotNav, e: NavEdge, from: NavNode, to: NavNode): BotControls => {
    if (bot.isGrounded && bot.pos.y > to.y - 10) {
        if (Math.abs(bot.pos.x - e.startX) > AT_X) return { ...IDLE, inputX: toward(bot.pos.x, e.startX) };
        if (bot.jetpackFuel < fuelFor(bot, from.y - to.y)) return IDLE; // wait for the tank to refill
    }
    return climbOnto(state, bot, nav, to, e.startX, e.endX);
};

const edgeMove = (state: GameState, bot: Entity, nav: BotNav, graph: NavGraph, e: NavEdge, now: number): BotControls => {
    const from = graph.nodes[e.from], to = graph.nodes[e.to];
    switch (e.kind) {
        case 'walk': return { ...IDLE, inputX: Math.sign(e.endX - e.startX) };
        // Walk off the edge, then steer for the landing spot without the jetpack
        case 'drop': return { ...IDLE, inputX: bot.isGrounded ? Math.sign(e.endX - bot.pos.x) : toward(bot.pos.x, e.endX, 8) };
        case 'jet': return jetMove(state, bot, nav, e, from, to);
        case 'hook': return hookMove(state, bot, nav, e, to, now);
    }
};

/** On the goal's surface (or the closest one reachable): walk to the goal, staying on it,
 *  and hop up to it if it floats overhead (pickups hang in the air on some maps). */
const arrive = (bot: Entity, here: NavNode, goal: Vector2): BotControls => {
    // Clamp to the surface itself, no inset: a pickup at the very edge must still come within reach
    const x = Math.min(Math.max(goal.x, here.x0), here.x1);
    const inputX = Math.abs(x - bot.pos.x) > ARRIVE_X ? Math.sign(x - bot.pos.x) : 0;
    const overhead = goal.y < here.y - REACH_UP && goal.y >= here.y - HOP_RISE && Math.abs(goal.x - bot.pos.x) < ARRIVE_X * 2;
    // Take off only with a decent tank (else it never refills), keep going once airborne
    const fuelOk = bot.isGrounded ? bot.jetpackFuel >= HOP_FUEL : bot.jetpackFuel > 0;
    return { ...IDLE, inputX, isFlying: overhead && fuelOk && bot.pos.y > goal.y + 20 };
};

export const steer = (state: GameState, bot: Entity, nav: BotNav, graph: NavGraph, goal: Vector2, now: number): BotControls => {
    const edge = nav.path[0];
    if (edge) return edgeMove(state, bot, nav, graph, edge, now);
    const here = nodeAt(graph, bot.pos);
    // Nothing below at all (knocked off the map's edge): fly back towards the goal
    if (!here) return { ...IDLE, inputX: toward(bot.pos.x, goal.x), isFlying: bot.jetpackFuel > 0 };
    return arrive(bot, here, goal);
};
