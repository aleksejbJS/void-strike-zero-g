// Which build slots each setup-screen tab shows. The colours tab has no part slots, only colour rows.

import { Slot } from '../../../game/build/buildParts';

export type TabId = 'head' | 'body' | 'jetpack' | 'colours';

export const TABS: { id: TabId; slots: Slot[] }[] = [
    { id: 'head', slots: ['helmet', 'visor', 'ears'] },
    { id: 'body', slots: ['tail', 'pattern', 'badge'] },
    { id: 'jetpack', slots: ['jetpack', 'flame'] },
    { id: 'colours', slots: [] },
];
