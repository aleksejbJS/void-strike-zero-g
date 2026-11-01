// Jetpack climb onto a surface above, shared by jet edges and the finish of hook edges:
// rise beside the surface (never under it), then cross over its edge and settle on it.

import { Entity, GameState } from '../../types';
import { NavNode, segmentClear } from './botNavGraph';
import { BotControls, BotNav } from './botNavState';

const BODY_H = 74, HALF_W = 16;
const ZIG = 24; // px either side of the take-off point while climbing in place

export const toward = (from: number, to: number, dead = 6) => (Math.abs(to - from) <= dead ? 0 : Math.sign(to - from));

export const climbOnto = (state: GameState, bot: Entity, nav: BotNav, to: NavNode, takeX: number, landX: number): BotControls => {
    const { x, y: feet } = bot.pos;
    const idle = { hook: false, reel: false };

    if (feet <= to.y - 6) {
        // Above the top: glide over, keeping height, and drop onto it once over it
        const over = x > to.x0 + 6 && x < to.x1 - 6;
        const sinking = bot.vel.y > 0.5 || feet > to.y - 30;
        return { ...idle, inputX: toward(x, landX), isFlying: !over && sinking };
    }

    // Below the top. Under the surface itself: get out from under it on the take-off side
    const under = x > to.x0 - HALF_W - 4 && x < to.x1 + HALF_W + 4;
    if (under) {
        const out = Math.sign(takeX - landX) || (x < (to.x0 + to.x1) / 2 ? -1 : 1);
        return { ...idle, inputX: out, isFlying: true };
    }

    // A clear diagonal to the landing spot: thrust straight for it
    const top = to.y - BODY_H - 10;
    const diagonal = segmentClear(state.platforms, { x, y: feet - BODY_H }, { x: landX, y: top })
        && segmentClear(state.platforms, { x, y: feet - 4 }, { x: landX, y: to.y - 4 });
    if (diagonal) return { ...idle, inputX: toward(x, landX), isFlying: true };

    // Otherwise climb in place: side thrust burns less fuel, so zigzag around the take-off point
    if (Math.abs(x - takeX) > ZIG) nav.zig = Math.sign(takeX - x);
    return { ...idle, inputX: nav.zig, isFlying: true };
};
