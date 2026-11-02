// What each part tile pictures: the player's current build with only that tile's part swapped in.
// Pure data, no Pixi, so it can be unit-tested without WebGL.

import { FighterBuild, SLOTS, Slot } from '../../../game/build/buildParts';

const HEAD_SLOTS: readonly Slot[] = ['helmet', 'visor', 'ears'];

/** Head slots are pictured as the head alone; every other slot as the whole fighter. */
export const isHeadSlot = (slot: Slot): boolean => HEAD_SLOTS.includes(slot);

/** One build per option of `slot`: `base` with that slot set to the option. */
export const thumbnailBuilds = (slot: Slot, base: FighterBuild): Array<{ id: string; build: FighterBuild }> =>
    SLOTS[slot].map(id => ({ id, build: { ...base, [slot]: id } }));
