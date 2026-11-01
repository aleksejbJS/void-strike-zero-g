// Bot brain: senses a target, picks a goal for the mode, then steers and shoots
// through the same controls a player has (the Force Pipeline moves it).

import { Entity, GameMode, GameState, Platform, Vector2 } from '../../types';
import { distance } from '../utils/math';
import { getWaypoints } from '../data/level';
import { BOT_UNSTICK_MS, detectStuck, getBotMemory } from './botMemory';
import { senseTarget } from './botSenses';
import { pickBestWeapon } from './botWeapons';
import { chooseGoal } from './botGoals';
import { aimAndFire } from './botAim';
import { insideZone } from './hungerRound';

export { clearBotMemory } from './botMemory';
export { botHasLineOfSight } from './botSenses';

export interface BotControls {
    inputX: number;     // -1, 0 or 1, like A/D
    isFlying: boolean;  // jetpack
}

const IDLE: BotControls = { inputX: 0, isFlying: false };
const LEVEL_SLACK = 80; // goals within this many px up or down count as "same level"

/** Direction to the nearer edge of a platform (an edge inside the zone), to get around it. */
const towardEdge = (state: GameState, bot: Entity, platform: Platform | undefined): number => {
    if (!platform) return 0;
    const edges = [{ dir: -1, x: platform.x - 20 }, { dir: 1, x: platform.x + platform.w + 20 }]
        .filter(e => insideZone(state, { x: e.x, y: bot.pos.y }))
        .sort((a, b) => Math.abs(a.x - bot.pos.x) - Math.abs(b.x - bot.pos.x));
    return edges[0]?.dir ?? 0;
};

const overX = (bot: Entity, p: Platform) => bot.pos.x >= p.x - 15 && bot.pos.x <= p.x + p.w + 15;

/** Goal straight below: walk off the platform. Goal straight above a platform overhead: get out from under it. */
const detourDirection = (state: GameState, bot: Entity, goal: Vector2, below: boolean): number => {
    const blocker = below
        ? state.platforms.find(p => overX(bot, p) && Math.abs(bot.pos.y - p.y) < 8)
        : state.platforms.find(p => overX(bot, p) && p.y + p.h <= bot.pos.y - 40 && p.y > goal.y);
    return towardEdge(state, bot, blocker);
};

export const updateBotAI = (bot: Entity, state: GameState, now: number, fireWeaponCallback: (bot: Entity, target: Vector2) => void, mode?: GameMode): BotControls => {
    if (bot.dead) return IDLE;
    const mem = getBotMemory(bot, mode);

    const sensed = senseTarget(state, bot, mem, now);
    pickBestWeapon(bot, sensed ? distance(bot.pos, sensed.pos) : 400);
    const { moveTarget, target } = chooseGoal(state, bot, mem, sensed, mode);

    // Steering: walk towards the goal, jetpack up to it, drop down to it
    const dx = moveTarget.x - bot.pos.x;
    const goalAbove = moveTarget.y < bot.pos.y - LEVEL_SLACK;
    const goalBelow = moveTarget.y > bot.pos.y + LEVEL_SLACK;
    let inputX = Math.abs(dx) > 30 ? Math.sign(dx) : 0;
    if (inputX === 0 && ((goalBelow && bot.isGrounded) || goalAbove)) inputX = detourDirection(state, bot, moveTarget, goalBelow);
    let isFlying = bot.jetpackFuel > 5 && (goalAbove || (!bot.isGrounded && !goalBelow));
    if (target && !goalBelow && target.pos.y < bot.pos.y - 100 && bot.jetpackFuel > 30) isFlying = true;

    // Tried to move but barely did: jetpack out and try the next waypoint
    if (detectStuck(mem, bot, inputX !== 0 || isFlying, now)) {
        mem.unstickUntil = now + BOT_UNSTICK_MS;
        mem.roamIndex = (mem.roamIndex + 1) % getWaypoints(mode).length;
    }
    if (now < mem.unstickUntil && bot.jetpackFuel > 0) isFlying = true;

    if (target) aimAndFire(state, bot, target, mem, now, fireWeaponCallback);
    else {
        bot.aim = undefined;
        if (inputX !== 0) bot.facingRight = inputX > 0;
    }

    return { inputX, isFlying };
};
