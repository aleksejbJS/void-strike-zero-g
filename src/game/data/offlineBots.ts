// How many bots an offline match starts with, by mode.

import { isLastStop, LAST_STOP_PLAYER_COUNT } from './lastStop/layout';
import { GameMode, MapId } from '../../types';
import { HUNGER_ROUND_SIZE } from '../systems/hungerRound';
import { isTeamMatch } from '../systems/matchRound';

/** The test range has dummies instead of bots; Hunger Games fills its round; team modes get six, the rest three. */
export const offlineBotCount = (mode: GameMode, map?: MapId): number => {
    if (isLastStop(mode, map)) return LAST_STOP_PLAYER_COUNT - 1;
    if (mode === GameMode.RANGE) return 0;
    if (mode === GameMode.HUNGER_GAMES) return HUNGER_ROUND_SIZE - 1;
    return isTeamMatch(mode) ? 6 : 3;
};
