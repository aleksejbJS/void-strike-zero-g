// What a bot perceives: line of sight and which enemy to fight.

import { Entity, GameState, Vector2 } from '../../types';
import { BOT_AIM_DISTANCE } from '../../constants';
import { distance, normalize, checkPointInRect } from '../utils/math';
import { isTeammate } from './combat';
import { BotMemory, reactionDelay } from './botMemory';
import { smokeHides } from './smoke';
import { spawnShieldLeft } from './spawnShield';
import { sightBlocks } from '../cover/coverGeometry';

// Re-picking a target only this often also works as the bot's reaction time
const BOT_SCAN_INTERVAL_MS = 200;
const MUZZLE_HEIGHT = 50; // same origin as fireWeapon

export const muzzleOf = (e: Entity): Vector2 => ({ x: e.pos.x, y: e.pos.y - MUZZLE_HEIGHT });
export const centerOf = (e: Entity): Vector2 => ({ x: e.pos.x, y: e.pos.y - e.height / 2 });
const HEAD_SHARE = 0.85; // the head sits this far up the body
const headOf = (e: Entity): Vector2 => ({ x: e.pos.x, y: e.pos.y - e.height * HEAD_SHARE });

export const isEnemy = (bot: Entity, other: Entity) => other.id !== bot.id && !isTeammate(bot, other);

/** No platform between the two points (cover not counted), and `to` within aiming distance. */
export const platformsClear = (state: GameState, from: Vector2, to: Vector2) => {
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

/** Platforms and intact cover that blocks sight (everything but glass) hide what is behind them. */
export const botHasLineOfSight = (state: GameState, from: Vector2, to: Vector2) =>
    platformsClear(state, from, to) && !sightBlocks(state, from, to);

/** Where the bot aims at `other`: its middle, or its head when cover hides only the middle
 *  (a fighter standing behind a crate, or the bot shooting over the crate it hides behind). */
export const aimPointOf = (state: GameState, bot: Entity, other: Entity): Vector2 => {
    const muzzle = muzzleOf(bot), middle = centerOf(other), head = headOf(other);
    return sightBlocks(state, muzzle, middle) && !sightBlocks(state, muzzle, head) ? head : middle;
};

/** Walls, cover and smoke all block sight; a bot standing in smoke still sees out of it. */
export const canSee = (state: GameState, bot: Entity, other: Entity, now = Date.now()) =>
    distance(bot.pos, other.pos) < BOT_AIM_DISTANCE
    && platformsClear(state, muzzleOf(bot), centerOf(other))
    && !sightBlocks(state, muzzleOf(bot), aimPointOf(state, bot, other))
    && !smokeHides(state, muzzleOf(bot), centerOf(other), now);

/** Nearest enemy the bot can see (one that can be hurt beats one under spawn protection);
 *  if none is visible, the nearest one to head towards, preferring one smoke does not hide
 *  (a wall does not hide where it is). */
const pickTarget = (state: GameState, bot: Entity, now: number): { target: Entity | null; visible: boolean } => {
    const enemies = state.players
        .filter(o => !o.dead && isEnemy(bot, o))
        .map(o => ({ o, d: distance(bot.pos, o.pos) }))
        .sort((a, b) => a.d - b.d);
    const seen = enemies.filter(({ o }) => canSee(state, bot, o, now));
    const visible = seen.find(({ o }) => spawnShieldLeft(o, now) <= 0) ?? seen[0];
    const unhidden = visible ? undefined : enemies.find(({ o }) => !smokeHides(state, muzzleOf(bot), centerOf(o), now));
    return { target: (visible ?? unhidden ?? enemies[0])?.o ?? null, visible: !!visible };
};

export const senseTarget = (state: GameState, bot: Entity, mem: BotMemory, now: number): Entity | null => {
    if (now >= mem.nextScanAt) {
        mem.nextScanAt = now + BOT_SCAN_INTERVAL_MS;
        const { target, visible } = pickTarget(state, bot, now);
        const spotted = visible && (target?.id !== mem.targetId || !mem.targetVisible);
        if (spotted) mem.fireAllowedAt = now + reactionDelay();
        mem.targetId = target?.id ?? null;
        mem.targetVisible = visible;
    }
    // A target that died stays forgotten until the next look around
    return state.players.find(p => p.id === mem.targetId && !p.dead) ?? null;
};
