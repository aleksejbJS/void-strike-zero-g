// What a bot reads from destructible cover: where to hide from a threat, which piece stands in
// the way of its shot, and an explosive barrel worth setting off next to an enemy.

import { Entity, GameState, Vector2, WeaponType } from '../../types';
import { distance } from '../utils/math';
import { BARREL_RADIUS, COVER_SPECS, Cover } from '../cover/coverTypes';
import { coverRect, firstCoverOnSegment, intactCover } from '../cover/coverGeometry';
import { isTeammate } from './combat';
import { aimPointOf, muzzleOf, platformsClear } from './botSenses';
import { spawnShieldLeft } from './spawnShield';

const SPOT_REACH = 400;       // px: crates farther than this from the bot are not worth running to
const SPOT_GAP = 18;          // px between the crate's side and the bot's centre
const BARREL_KEEP_OFF = 120;  // px: never hide this close to an intact barrel
const BARREL_SAFE_MARGIN = 20; // px past the blast radius a teammate (or the bot) must be

const isCrate = (c: Cover) => c.kind === 'wood' || c.kind === 'metal';
/** The bot stands right beside this piece (the crate it hides behind). */
const besideBot = (bot: Entity, c: Cover) =>
    Math.abs(c.pos.y - bot.pos.y) < 4 && Math.abs(c.pos.x - bot.pos.x) <= COVER_SPECS[c.kind].w / 2 + SPOT_GAP + 8;
const pieceCentre = (c: Cover): Vector2 => ({ x: c.pos.x, y: c.pos.y - COVER_SPECS[c.kind].h / 2 });
const onFloor = (state: GameState, spot: Vector2) =>
    state.platforms.some(p => Math.abs(p.y - spot.y) < 2 && spot.x >= p.x && spot.x <= p.x + p.w);

/** Where to crouch out of `threat`'s fire: beside the nearest intact crate (within reach) that lies between
 *  the bot and the threat, on its side away from the threat. Never a barrel, never next to one. */
export const findCoverSpot = (state: GameState, bot: Entity, threat: Entity): Vector2 | null => {
    const pieces = intactCover(state);
    const barrels = pieces.filter(c => c.kind === 'barrel');
    const lo = Math.min(bot.pos.x, threat.pos.x), hi = Math.max(bot.pos.x, threat.pos.x);
    const side = Math.sign(threat.pos.x - bot.pos.x) || 1;
    let best: Vector2 | null = null, bestDist = Infinity;
    for (const c of pieces) {
        const r = coverRect(c), d = distance(bot.pos, c.pos);
        if (!isCrate(c) || d > SPOT_REACH || d >= bestDist || r.x < lo || r.x + r.w > hi) continue;
        const spot = { x: c.pos.x - side * (r.w / 2 + SPOT_GAP), y: c.pos.y };
        if (!onFloor(state, spot) || barrels.some(b => distance(spot, b.pos) < BARREL_KEEP_OFF)) continue;
        best = spot;
        bestDist = d;
    }
    return best;
};

/** The piece to shoot down on the way to `target`: the first intact one on the line from the muzzle to
 *  where the bot aims at the target. Wood and glass always; metal only for a rocket or grenade launcher.
 *  A railgun beam goes through wood and glass, so it ignores them (and it cannot break metal). Barrels
 *  are barrelToShoot's call, and the crate the bot hides behind is never shot down. */
export const coverToShoot = (state: GameState, bot: Entity, target: Entity): Cover | null => {
    const rail = bot.weapon.type === WeaponType.RAILGUN;
    const explosive = bot.weapon.type === WeaponType.ROCKET_LAUNCHER || bot.weapon.type === WeaponType.GRENADE_LAUNCHER;
    const hit = firstCoverOnSegment(state, muzzleOf(bot), aimPointOf(state, bot, target), c => !(rail && (c.kind === 'wood' || c.kind === 'glass')));
    if (!hit || besideBot(bot, hit.cover)) return null;
    const { kind } = hit.cover;
    return kind === 'wood' || kind === 'glass' || (kind === 'metal' && explosive) ? hit.cover : null;
};

/** An intact barrel in plain view with an enemy inside its blast, and no teammate, nor the bot itself,
 *  within the blast plus a margin (a barrel hurts everyone at full damage). */
export const barrelToShoot = (state: GameState, bot: Entity, now = Date.now()): Cover | null => {
    const muzzle = muzzleOf(bot);
    for (const barrel of intactCover(state)) {
        if (barrel.kind !== 'barrel') continue;
        const centre = pieceCentre(barrel);
        const near = (p: Entity, reach: number) => !p.dead && distance(centre, p.pos) < reach;
        const friendly = state.players.some(p => (p.id === bot.id || isTeammate(bot, p)) && near(p, BARREL_RADIUS + BARREL_SAFE_MARGIN));
        const enemy = state.players.some(p => p.id !== bot.id && !isTeammate(bot, p) && spawnShieldLeft(p, now) <= 0 && near(p, BARREL_RADIUS));
        if (friendly || !enemy) continue;
        const inView = platformsClear(state, muzzle, centre)
            && !firstCoverOnSegment(state, muzzle, centre, c => c.id !== barrel.id && COVER_SPECS[c.kind].blocksSight);
        if (inView) return barrel;
    }
    return null;
};

/** Where to aim at a piece of cover (its middle). */
export const coverAimPoint = pieceCentre;
