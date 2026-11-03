// How smoke changes what the screen shows of a fighter: anyone standing in a cloud is hidden,
// except your own fighter, which you still see as a faint outline drawn over the cloud.
// The test point is the body centre; `pos` is the feet (centreX, bottomY).

import { Entity, GameState } from '../../types';
import { insideSmoke } from '../systems/smoke';

export type SmokeVisibility = 'shown' | 'hidden' | 'silhouette';

/** The hitbox outline drawn for your own fighter in smoke: feet at (x, y), `w` × `h`. */
export type SmokeSilhouette = { x: number; y: number; w: number; h: number };

export const fighterSmokeVisibility = (inSmoke: boolean, isLocal: boolean): SmokeVisibility => {
    if (!inSmoke) return 'shown';
    return isLocal ? 'silhouette' : 'hidden';
};

/** True if the fighter's body centre is inside a cloud. */
export const fighterInSmoke = (state: GameState, p: Entity, now: number): boolean =>
    insideSmoke(state, { x: p.pos.x, y: p.pos.y - p.height / 2 }, now);

/** The outline to draw for the local fighter, or null when it is not standing in smoke. */
export const smokeSilhouette = (state: GameState, local: Entity | undefined, now: number): SmokeSilhouette | null => {
    if (!local || local.dead || !fighterInSmoke(state, local, now)) return null;
    return { x: local.pos.x, y: local.pos.y, w: local.width, h: local.height };
};
