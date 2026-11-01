// Bot brain: senses a target, picks a goal for the mode, then steers and shoots
// through the same controls a player has (the Force Pipeline moves it).

import { Entity, GameMode, GameState, Vector2 } from '../../types';
import { BOT_FIRE_COOLDOWN_SCALE, BOT_VERTICAL_TOLERANCE } from '../../constants';
import { distance } from '../utils/math';
import { getWaypoints } from '../data/level';
import { FIXED_STEP_MS } from './fixedStep';
import { BOT_UNSTICK_MS, detectStuck, getBotMemory } from './botMemory';
import { canSee, centerOf, senseTarget } from './botSenses';
import { pickBestWeapon } from './botWeapons';
import { chooseGoal } from './botGoals';

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

    const fireReady = now - bot.lastFired > bot.weapon.fireRate * BOT_FIRE_COOLDOWN_SCALE;
    if (!fireReady || Math.abs(target.pos.y - bot.pos.y) >= BOT_VERTICAL_TOLERANCE) return;
    if (!canSee(state, bot, target)) return;
    fire(bot, {
        x: aim.x + (Math.random() - 0.5) * AIM_SPREAD,
        y: aim.y + (Math.random() - 0.5) * AIM_SPREAD,
    });
};

export const updateBotAI = (bot: Entity, state: GameState, now: number, fireWeaponCallback: (bot: Entity, target: Vector2) => void, mode?: GameMode): BotControls => {
    if (bot.dead) return IDLE;
    const mem = getBotMemory(bot, mode);

    const sensed = senseTarget(state, bot, mem, now);
    pickBestWeapon(bot, sensed ? distance(bot.pos, sensed.pos) : 400);
    const { moveTarget, target } = chooseGoal(state, bot, mem, sensed, mode);

    // Steering: walk towards the goal, jetpack up to it, drop down to it
    const dx = moveTarget.x - bot.pos.x;
    const inputX = Math.abs(dx) > 30 ? Math.sign(dx) : 0;
    const goalAbove = moveTarget.y < bot.pos.y - LEVEL_SLACK;
    const goalBelow = moveTarget.y > bot.pos.y + LEVEL_SLACK;
    let isFlying = bot.jetpackFuel > 5 && (goalAbove || (!bot.isGrounded && !goalBelow));
    if (target && !goalBelow && target.pos.y < bot.pos.y - 100 && bot.jetpackFuel > 30) isFlying = true;

    // Tried to move but barely did: jetpack out and try the next waypoint
    if (detectStuck(mem, bot, inputX !== 0 || isFlying, now)) {
        mem.unstickUntil = now + BOT_UNSTICK_MS;
        mem.roamIndex = (mem.roamIndex + 1) % getWaypoints(mode).length;
    }
    if (now < mem.unstickUntil && bot.jetpackFuel > 0) isFlying = true;

    if (target) aimAndFire(state, bot, target, now, fireWeaponCallback);
    else if (inputX !== 0) bot.facingRight = inputX > 0;

    return { inputX, isFlying };
};
