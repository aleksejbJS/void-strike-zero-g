// Where a shot, a railgun beam or a flame ray can hurt a fighter: its movement box with the top
// raised to the top of its drawing. The illustrated bodies are drawn taller than the box (the cat's
// head sat almost entirely above it), so a shot at the drawn face flew over. Movement keeps the box.

import type { Entity } from '../../types';
import { BodyId, isBodyId } from '../build/bodyTypes';
import { presetBuild } from '../build/buildPresets';

type Stance = 'stand' | 'crouch' | 'prone';

/**
 * Top of each body's opaque drawing above its feet, by stance, over every aim, weapon and step,
 * tail left out; rounded up. hitZone.test.ts measures the pictures and fails if the art drifts.
 */
export const DRAWN_TOP: Readonly<Record<BodyId, Readonly<Record<Stance, number>>>> = {
    'human': { stand: 80.5, crouch: 55, prone: 33.5 },
    'human-female': { stand: 75.5, crouch: 50.5, prone: 33.5 },
    'robot': { stand: 78.5, crouch: 54.5, prone: 38.5 },
    'toxic': { stand: 81.5, crouch: 55.5, prone: 33.5 },
    'cat': { stand: 96.5, crouch: 70, prone: 45.5 },
};

type Fighter = Pick<Entity, 'pos' | 'width' | 'height' | 'isCrouching' | 'isProne' | 'build' | 'skinId'>;

const stanceOf = (e: Fighter): Stance => (e.isProne ? 'prone' : e.isCrouching ? 'crouch' : 'stand');

/** The illustrated body the fighter is drawn with; a missing build means the preset of its skin. */
const bodyOf = (e: Fighter): BodyId | undefined => {
    const body = e.build ? e.build.body : presetBuild(e.skinId).body;
    return isBodyId(body) ? body : undefined;
};

/** The box a damage check tests: feet and width as the movement box, never lower than it. */
export const hitRect = (e: Fighter): { x: number; y: number; w: number; h: number } => {
    const body = bodyOf(e);
    const h = Math.max(e.height, body ? DRAWN_TOP[body][stanceOf(e)] : 0);
    return { x: e.pos.x - e.width / 2, y: e.pos.y - h, w: e.width, h };
};
