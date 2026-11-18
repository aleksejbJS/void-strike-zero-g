// How many bots an offline match starts with, by mode.

import { GameMode } from '../../types';
import { HUNGER_ROUND_SIZE } from '../systems/hungerRound';
import { isTeamMatch } from '../systems/matchRound';

/** The test range has dummies instead of bots; Hunger Games fills its round; team modes get six, the rest three. */
export const offlineBotCount = (mode: GameMode): number => {
    if (mode === GameMode.RANGE) return 0;
    if (mode === GameMode.HUNGER_GAMES) return HUNGER_ROUND_SIZE - 1;
    return isTeamMatch(mode) ? 6 : 3;
};
