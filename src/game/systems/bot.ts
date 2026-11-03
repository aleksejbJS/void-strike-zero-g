// Bot brain: senses a target, picks a goal for the mode, follows a route on the map's
// navigation graph to it and moves in a fight — through the same controls a player has
// (walk, jetpack, grapple hook; the Force Pipeline moves it).

import { Entity, GameMode, GameState, Vector2 } from '../../types';
import { distance } from '../utils/math';
import { BOT_UNSTICK_MS, detectStuck, getBotMemory } from './botMemory';
import { senseTarget } from './botSenses';
import { pickBestWeapon } from './botWeapons';
import { chooseGoal } from './botGoals';
import { forgetStale } from './botSearch';
import { aimAndFire } from './botAim';
import { buildNavGraph } from './botNavGraph';
import { blockEdge, updateRoute } from './botRoute';
import { steer } from './botSteering';
import { combatMoves } from './botCombatMoves';
import { BotControls, IDLE } from './botNavState';

export { clearBotMemory } from './botMemory';
export { botHasLineOfSight } from './botSenses';
export type { BotControls } from './botNavState';

const SHOOT_UP_PX = 100; // a visible enemy this far above: jetpack up to get a shot

export const updateBotAI = (bot: Entity, state: GameState, now: number, fireWeaponCallback: (bot: Entity, target: Vector2) => void, _mode?: GameMode): BotControls => {
    if (bot.dead) return IDLE;
    const mem = getBotMemory(bot);
    const graph = buildNavGraph(state.platforms);
    forgetStale(state, mem, now);

    const sensed = senseTarget(state, bot, mem, now);
    pickBestWeapon(bot, sensed ? distance(bot.pos, sensed.pos) : 400);
    const { moveTarget, target } = chooseGoal(state, bot, mem, sensed, graph, now);

    updateRoute(state, bot, mem.nav, graph, moveTarget, now);
    let controls = steer(state, bot, mem.nav, graph, moveTarget, now);
    controls = combatMoves(state, bot, mem.nav, mem.moves, graph, target, mem.targetVisible, controls, now);

    // At the goal with a visible enemy overhead: jetpack up for a shot
    const enemyAbove = target && mem.targetVisible && target.pos.y < bot.pos.y - SHOOT_UP_PX;
    if (enemyAbove && mem.nav.path.length === 0 && bot.jetpackFuel > 30) controls = { ...controls, isFlying: true };

    // Last resort: tried to move but barely did — give up on this edge and plan around it
    const moving = controls.inputX !== 0 || controls.isFlying || controls.reel;
    if (detectStuck(mem, bot, moving, now)) {
        if (mem.nav.path[0]) blockEdge(mem.nav, mem.nav.path[0], now);
        mem.unstickUntil = now + BOT_UNSTICK_MS;
    }
    if (now < mem.unstickUntil && bot.jetpackFuel > 0 && !bot.grapple.active) controls = { ...controls, isFlying: true };

    // No target, or one hidden in smoke that the bot never saw: look where it is going
    if (!target || !aimAndFire(state, bot, target, mem, now, fireWeaponCallback)) {
        bot.aim = undefined;
        if (controls.inputX !== 0) bot.facingRight = controls.inputX > 0;
    }
    return controls;
};
