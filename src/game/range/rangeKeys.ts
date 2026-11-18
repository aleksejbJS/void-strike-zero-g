// The range's own keys (#range): what C, K, H and R change in the range settings. Esc (leave the range)
// is handled by GameCanvas, like it is in every mode.

import { nextStance } from './rangeState';
import type { RangeState } from './rangeState';

/** Applies a range key by its `KeyboardEvent.code`. Returns true when the key was one of the range's. */
export const applyRangeKey = (code: string, range: RangeState): boolean => {
    switch (code) {
        case 'KeyC': range.stance = nextStance(range.stance); return true;
        case 'KeyK': range.armored = !range.armored; return true;
        case 'KeyH': range.showHitZones = !range.showHitZones; return true;
        case 'KeyR': range.resetRequested = true; return true;
        default: return false;
    }
};
