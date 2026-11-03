// How a locked achievement's progress reads on its card. Most counts are plain numbers; the two
// time-based achievements store seconds, which would read as "0 / 36000", so they get a unit.

import type { Achievement } from '../../game/systems/achievements';
import type { Translate } from '../menu/types';

const SECONDS_PER_HOUR = 3600;

export function progressLabel(a: Pick<Achievement, 'id' | 'progress' | 'maxProgress'>, t: Translate): string {
    switch (a.id) {
        case 'veteran': // play time, stored in seconds, shown in whole hours
            return t('pf.progress.hours', Math.floor(a.progress / SECONDS_PER_HOUR), Math.floor(a.maxProgress / SECONDS_PER_HOUR));
        case 'king_of_hill': // flag hold time, stored and shown in seconds
            return t('pf.progress.seconds', Math.floor(a.progress), a.maxProgress);
        default:
            return `${a.progress} / ${a.maxProgress}`;
    }
}
