// Bot brain: senses a target, picks a goal for the mode, then steers and shoots
// through the same controls a player has (the Force Pipeline moves it).

import { Entity, GameMode, GameState, Platform, Vector2 } from '../../types';
import { BOT_FIRE_COOLDOWN_SCALE, BOT_VERTICAL_TOLERANCE } from '../../constants';
import { distance } from '../utils/math';
import { getWaypoints } from '../data/level';
import { FIXED_STEP_MS } from './fixedStep';
import { BOT_UNSTICK_MS, detectStuck, getBotMemory } from './botMemory';
import { canSee, centerOf, muzzleOf, senseTarget } from './botSenses';
import { pickBestWeapon } from './botWeapons';
import { chooseGoal } from './botGoals';
import { hungerShieldLeft, insideZone } from './hungerRound';

export { clearBotMemory } from './botMemory';
export { botHasLineOfSight } from './botSenses';

export interface BotControls {
    inputX: number;     // -1, 0 or 1, like A/D
    isFlying: boolean;  // jetpack
}

const IDLE: BotControls = { inputX: 0, isFlying: false };
// Bodies move velocity × this many px per tick (Matter measures velocity per 60 Hz frame);
// projectiles move their full velocity every tick.
const BODY_PX_PER_TICK = FIXED_STEP_MS / (1000 / 60);
const AIM_SPREAD = 40;
const LEVEL_SLACK = 80; // goals within this many px up or down count as "same level"

const aimAndFire = (state: GameState, bot: Entity, target: Entity, now: number, fire: (bot: Entity, target: Vector2) => void) => {
    const ticksToHit = bot.weapon.speed > 0 ? distance(bot.pos, target.pos) / bot.weapon.speed : 0;
    const lead = ticksToHit * BODY_PX_PER_TICK;
    const center = centerOf(target);
    const aim = { x: center.x + target.vel.x * lead, y: center.y + target.vel.y * lead };
    bot.facingRight = aim.x > bot.pos.x;
    const muzzle = muzzleOf(bot);
    bot.aim = Math.atan2(aim.y - muzzle.y, aim.x - muzzle.x); // drawn by the fighter's arms

    if (hungerShieldLeft(state, now) > 0) return; // shots do nothing yet, don't waste them
    const fireReady = now - bot.lastFired > bot.weapon.fireRate * BOT_FIRE_COOLDOWN_SCALE;
    if (!fireReady || Math.abs(target.pos.y - bot.pos.y) >= BOT_VERTICAL_TOLERANCE) return;
    if (!canSee(state, bot, target)) return;
    fire(bot, {
        x: aim.x + (Math.random() - 0.5) * AIM_SPREAD,
        y: aim.y + (Math.random() - 0.5) * AIM_SPREAD,
    });
};

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

    if (target) aimAndFire(state, bot, target, now, fireWeaponCallback);
    else {
        bot.aim = undefined;
        if (inputX !== 0) bot.facingRight = inputX > 0;
    }

    return { inputX, isFlying };
};
