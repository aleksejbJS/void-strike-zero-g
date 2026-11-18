// Shared geometry for the range map tests: the room's walls and ledges, cover and dummy boxes, and the shooter.

import type { Platform, Vector2 } from '../../types';
import { presetBuild } from '../build/buildPresets';
import { COVER_SPECS } from '../cover/coverTypes';
import { hitRect } from '../systems/hitZone';
import { CROUCH_HEIGHT, PRONE_HEIGHT, STANDING_HEIGHT } from '../systems/stance';
import { DUMMY_SPOTS, RANGE_COVER, RANGE_PLATFORMS, RANGE_SPAWN } from './rangeMap';

export type Rect = { x: number; y: number; w: number; h: number };
export type PlatformDef = Omit<Platform, 'id'>;
export type DummySpot = (typeof DUMMY_SPOTS)[number];
export type DummyStance = 'stand' | 'crouch' | 'prone';

export const FIGHTER = { w: 30, h: STANDING_HEIGHT };
export const SHOOTER: Vector2 = { x: RANGE_SPAWN.x, y: RANGE_SPAWN.y - 50 }; // the spawn's standing chest

export const floor = RANGE_PLATFORMS.find(p => p.y === 800 && p.x <= 0 && p.x + p.w >= 1500) as PlatformDef;
export const ceiling = RANGE_PLATFORMS.find(p => p.y + p.h === 0 && p.x <= 0 && p.x + p.w >= 1500) as PlatformDef;
export const leftWall = RANGE_PLATFORMS.find(p => p.x + p.w === 0 && p.y <= 0 && p.y + p.h >= 800) as PlatformDef;
export const rightWall = RANGE_PLATFORMS.find(p => p.x === 1500 && p.y <= 0 && p.y + p.h >= 800) as PlatformDef;
export const WALLS = [floor, ceiling, leftWall, rightWall];
export const LEDGES = RANGE_PLATFORMS.filter(p => !WALLS.includes(p));

export const grown = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });
export const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
export const coverRect = ([kind, x, y]: (typeof RANGE_COVER)[number]): Rect => {
    const { w, h } = COVER_SPECS[kind];
    return { x: x - w / 2, y: y - h, w, h };
};
export const dummyRect = (pos: Vector2): Rect => ({ x: pos.x - FIGHTER.w / 2, y: pos.y - FIGHTER.h, w: FIGHTER.w, h: FIGHTER.h });

const STANCE_HEIGHT: Record<DummyStance, number> = { stand: STANDING_HEIGHT, crouch: CROUCH_HEIGHT, prone: PRONE_HEIGHT };

/** The damage box of a dummy of this base in this stance (taller than the movement box for the drawn heads, the Cat's most). */
export const dummyHitRect = (spot: DummySpot, stance: DummyStance): Rect => hitRect({
    pos: spot.pos, width: FIGHTER.w, height: STANCE_HEIGHT[stance], isCrouching: stance === 'crouch', isProne: stance === 'prone',
    skinId: spot.skinId, build: presetBuild(spot.skinId),
});
