// The build the local player takes into a match: the saved one, limited to the parts their level has opened.

import { FighterBuild } from './buildParts';
import { loadBuild } from './buildStorage';
import { loadXp } from './progress';
import { enforceUnlocks, levelForXp } from './unlocks';

export const currentBuild = (): FighterBuild => enforceUnlocks(loadBuild(), levelForXp(loadXp()));
