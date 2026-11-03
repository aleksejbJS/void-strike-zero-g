// Where a bot chases a fighter: the real position while smoke does not hide them, otherwise
// the spot where it last saw them, searched until the bot gets there. Walls do not hide a position.

import { Entity, GameState, Vector2 } from '../../types';
import { distance } from '../utils/math';
import { BotMemory } from './botMemory';
import { centerOf, muzzleOf } from './botSenses';
import { smokeHides } from './smoke';

export const SEARCH_REACHED = 48; // px: this close to the last-seen spot, it has been searched

/** The point to chase `target` at, or null when smoke hides them and there is no lead left. */
export const chasePoint = (state: GameState, bot: Entity, mem: BotMemory, target: Entity, now = Date.now()): Vector2 | null => {
    if (!smokeHides(state, muzzleOf(bot), centerOf(target), now)) {
        mem.lastSeen.set(target.id, { ...target.pos });
        return target.pos;
    }
    const spot = mem.lastSeen.get(target.id);
    if (!spot) return null;
    if (distance(bot.pos, spot) > SEARCH_REACHED) return spot;
    mem.lastSeen.delete(target.id);
    return null;
};
