// What a bot perceives: line of sight and which enemy to fight.

import { Entity, GameState, Vector2 } from '../../types';
import { BOT_AIM_DISTANCE } from '../../constants';
import { distance, normalize, checkPointInRect } from '../utils/math';
import { isTeammate } from './combat';
import { BotMemory, reactionDelay } from './botMemory';

// Re-picking a target only this often also works as the bot's reaction time
const BOT_SCAN_INTERVAL_MS = 200;
const MUZZLE_HEIGHT = 50; // same origin as fireWeapon

export const muzzleOf = (e: Entity): Vector2 => ({ x: e.pos.x, y: e.pos.y - MUZZLE_HEIGHT });
export const centerOf = (e: Entity): Vector2 => ({ x: e.pos.x, y: e.pos.y - e.height / 2 });

export const isEnemy = (bot: Entity, other: Entity) => other.id !== bot.id && !isTeammate(bot, other);

export const botHasLineOfSight = (state: GameState, from: Vector2, to: Vector2) => {
    const dir = normalize({ x: to.x - from.x, y: to.y - from.y });
    const cur = { ...from };
    let dist = 0;
    while (dist < BOT_AIM_DISTANCE) {
        cur.x += dir.x * 20;
        cur.y += dir.y * 20;
        dist += 20;
        if (checkPointInRect(cur, { x: to.x - 10, y: to.y - 10, w: 20, h: 20 })) return true;
        for (const p of state.platforms) if (checkPointInRect(cur, p)) return false;
    }
    return false;
};

export const canSee = (state: GameState, bot: Entity, other: Entity) =>
    distance(bot.pos, other.pos) < BOT_AIM_DISTANCE && botHasLineOfSight(state, muzzleOf(bot), centerOf(other));

/** Nearest enemy the bot can see; if none is visible, the nearest one to head towards. */
const pickTarget = (state: GameState, bot: Entity): { target: Entity | null; visible: boolean } => {
    const enemies = state.players
        .filter(o => !o.dead && isEnemy(bot, o))
        .map(o => ({ o, d: distance(bot.pos, o.pos) }))
        .sort((a, b) => a.d - b.d);
    const visible = enemies.find(({ o }) => canSee(state, bot, o));
    return { target: (visible ?? enemies[0])?.o ?? null, visible: !!visible };
};

export const senseTarget = (state: GameState, bot: Entity, mem: BotMemory, now: number): Entity | null => {
    if (now >= mem.nextScanAt) {
        mem.nextScanAt = now + BOT_SCAN_INTERVAL_MS;
        const { target, visible } = pickTarget(state, bot);
        const spotted = visible && (target?.id !== mem.targetId || !mem.targetVisible);
        if (spotted) mem.fireAllowedAt = now + reactionDelay();
        mem.targetId = target?.id ?? null;
        mem.targetVisible = visible;
    }
    // A target that died stays forgotten until the next look around
    return state.players.find(p => p.id === mem.targetId && !p.dead) ?? null;
};
