// What a bot remembers about getting around (its route) and about moving in a fight,
// plus the controls a bot presses each tick.

import { Vector2 } from '../../types';
import { NavEdge, NavGraph } from './botNavGraph';

export interface BotControls {
    inputX: number;     // -1, 0 or 1, like A/D
    isFlying: boolean;  // jetpack
    hook: boolean;      // grapple button held
    hookAim?: Vector2;  // where the grapple is fired
    reel: boolean;      // reel the rope in (W while hooked)
}

export const IDLE: BotControls = { inputX: 0, isFlying: false, hook: false, reel: false };

export interface BotNav {
    graph: NavGraph | null;         // the map the route was planned on
    path: NavEdge[];                // edges still to take; path[0] is the current one
    goalNode: number;               // surface the route leads to (-1: none yet)
    replanAt: number;
    lockedUntil: number;            // an escape move: no re-planning before this
    edgeKey: string;                // the current edge, to notice when it changes
    engagedAt: number;              // when the bot reached the current edge's take-off (0: not yet)
    blocked: Map<string, number>;   // edge key → blocked until (failed recently)
    hookFiredAt: number;            // 0: hook not fired on this edge yet
    hookReleased: boolean;          // let go of the rope, finishing with the jetpack
    zig: number;                    // zigzag direction while climbing in place
    roamNode: number;               // surface to roam to (-1: pick one)
    roamPickAt: number;             // earliest time to pick the next one
    seenAt: number;                 // last update (a gap means the bot was dead and respawned)
}

export interface BotMoves {
    strafeDir: number;
    strafeUntil: number;
    lastHealth: number;
    dodgeUntil: number;
    dodgeReadyAt: number;
    escapeReadyAt: number;
}

export const newBotNav = (): BotNav => ({
    graph: null, path: [], goalNode: -1, replanAt: 0, lockedUntil: 0, edgeKey: '', engagedAt: 0,
    blocked: new Map(), hookFiredAt: 0, hookReleased: false, zig: 1, roamNode: -1, roamPickAt: 0, seenAt: 0,
});

export const newBotMoves = (health: number): BotMoves => ({
    strafeDir: 0, strafeUntil: 0, lastHealth: health, dodgeUntil: 0, dodgeReadyAt: 0, escapeReadyAt: 0,
});
