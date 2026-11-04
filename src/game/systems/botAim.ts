// How a bot aims and when it pulls the trigger: a human-like reaction time, and an aim error
// that grows with distance and with how fast the target moves (a running, flying player far
// away is hard to hit; a standing one up close is not).

import { Entity, GameState, Vector2 } from '../../types';
import { BOT_FIRE_COOLDOWN_SCALE, BOT_VERTICAL_TOLERANCE } from '../../constants';
import { distance } from '../utils/math';
import { FIXED_STEP_MS } from './fixedStep';
import { BotMemory, reactionDelay } from './botMemory';
import { canSee, centerOf, muzzleOf } from './botSenses';
import { hungerShieldLeft } from './hungerRound';
import { spawnShieldLeft } from './spawnShield';
import { knownPos } from './botSearch';

// Bodies move velocity × this many px per tick (Matter measures velocity per 60 Hz frame);
// projectiles move their full velocity every tick.
const BODY_PX_PER_TICK = FIXED_STEP_MS / (1000 / 60);
const BASE_SPREAD = 0.035;   // aim error in radians at a standing target
const MOVING_SPREAD = 0.025; // extra radians per unit of target speed (running ≈ 4, flying up to 8)
const MIN_SPREAD_PX = 8;

/** Points the bot's gun at the target (or, when smoke hides it, at where it was last seen) and
 *  fires when it may. False when the bot has no idea where the target is: nothing to aim at. */
export const aimAndFire = (state: GameState, bot: Entity, target: Entity, mem: BotMemory, now: number, fire: (bot: Entity, target: Vector2) => void): boolean => {
    const known = knownPos(state, bot, mem, target, now);
    if (!known) return false;
    if (known !== target.pos) { // hidden in smoke: aim at the last-seen spot, never fire
        const muzzle = muzzleOf(bot);
        bot.facingRight = known.x > bot.pos.x;
        bot.aim = Math.atan2(known.y - target.height / 2 - muzzle.y, known.x - muzzle.x);
        return true;
    }
    const dist = distance(bot.pos, target.pos);
    const ticksToHit = bot.weapon.speed > 0 ? dist / bot.weapon.speed : 0;
    const lead = ticksToHit * BODY_PX_PER_TICK;
    const center = centerOf(target);
    const aim = { x: center.x + target.vel.x * lead, y: center.y + target.vel.y * lead };
    bot.facingRight = aim.x > bot.pos.x;
    const muzzle = muzzleOf(bot);
    bot.aim = Math.atan2(aim.y - muzzle.y, aim.x - muzzle.x); // drawn by the fighter's arms

    // Round-start shield: shots do nothing yet; react only once it is over
    const shield = hungerShieldLeft(state, now);
    if (shield > 0) {
        if (mem.fireAllowedAt < now + shield) mem.fireAllowedAt = now + shield + reactionDelay();
        return true;
    }
    // Target just back from a death can't be hurt yet: hold fire, let the reaction time run.
    // Not tied to the planned end: if the target fires, its shield drops and the bot answers soon.
    if (spawnShieldLeft(target, now) > 0) {
        if (mem.fireAllowedAt <= now) mem.fireAllowedAt = now + reactionDelay();
        return true;
    }
    if (now < mem.fireAllowedAt) return true;
    const fireReady = now - bot.lastFired > bot.weapon.fireRate * BOT_FIRE_COOLDOWN_SCALE;
    if (!fireReady || Math.abs(target.pos.y - bot.pos.y) >= BOT_VERTICAL_TOLERANCE) return true;
    if (!canSee(state, bot, target, now)) return true;

    const speed = Math.hypot(target.vel.x, target.vel.y);
    const spread = Math.max(MIN_SPREAD_PX, dist * (BASE_SPREAD + MOVING_SPREAD * speed));
    fire(bot, {
        x: aim.x + (Math.random() - 0.5) * 2 * spread,
        y: aim.y + (Math.random() - 0.5) * 2 * spread,
    });
    return true;
};
