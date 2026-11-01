// Grapple hook edges: walk to the take-off point, fire at the anchor, reel in, let go and
// finish over the edge with the jetpack. A hook that does not catch blocks the edge.

import { Entity, GameState } from '../../types';
import { NavEdge, NavNode } from './botNavGraph';
import { BotControls, BotNav, IDLE } from './botNavState';
import { blockEdge } from './botRoute';
import { climbOnto, toward } from './botClimb';

const AT_X = 12;
const MIN_FUEL = 60;          // enough left in the tank for the jetpack finish
const MISS_MS = 300;          // the hook should catch right away (the shot is instant)
const REEL_STOP = 74 + 12;    // rope this short: the head is right under the anchor

export const hookMove = (state: GameState, bot: Entity, nav: BotNav, e: NavEdge, to: NavNode, now: number): BotControls => {
    const anchor = e.anchor ?? { x: e.endX, y: to.y };

    if (bot.grapple.active) {
        nav.hookFiredAt = 0; // caught
        const high = bot.pos.y <= to.y - 6;
        if (!nav.hookReleased && !high && bot.grapple.length > REEL_STOP) {
            return { ...IDLE, hook: true, hookAim: anchor, reel: true };
        }
        nav.hookReleased = true; // letting go of the button releases the rope
    }

    // Back on the ground below after a try: start over (the edge's time limit stops endless tries)
    if (bot.isGrounded && !bot.grapple.active && bot.pos.y > to.y - 10) nav.hookReleased = false;

    if (!nav.hookReleased) {
        if (Math.abs(bot.pos.x - e.startX) > AT_X) return { ...IDLE, inputX: toward(bot.pos.x, e.startX) };
        if (bot.jetpackFuel < Math.min(MIN_FUEL, bot.maxFuel * 0.9)) return IDLE;
        if (!nav.hookFiredAt) nav.hookFiredAt = now;
        else if (now - nav.hookFiredAt > MISS_MS) { blockEdge(nav, e, now); return IDLE; }
        return { ...IDLE, hook: true, hookAim: anchor };
    }
    return climbOnto(state, bot, nav, to, e.startX, e.endX);
};
