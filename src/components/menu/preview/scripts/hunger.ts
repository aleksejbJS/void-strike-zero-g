// Hunger Games loop (8 s) in the show arena: the zone closes in and everyone moves to the
// middle; green guns down red, then the zone opens again for the next round.

import { Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { FLOOR_Y, LOW_Y, TOP_Y } from '../previewWorld';

const MG = WeaponType.MACHINE_GUN;

export const hungerScript: ModeScript = {
    duration: 8,
    zone: { wide: { x: 20, y: 20, w: 846, h: 446 }, tight: { x: 190, y: 80, w: 506, h: 380 } },
    actors: [
        {
            id: 'you', look: 'you', team: Team.NONE, weapon: MG, label: true,
            keys: [
                { t: 0, x: 130, y: LOW_Y },
                { t: 1.5, x: 130, y: LOW_Y },
                { t: 3.0, x: 260, y: LOW_Y },
                { t: 6.0, x: 260, y: LOW_Y },
                { t: 7.5, x: 130, y: LOW_Y },
                { t: 8, x: 130, y: LOW_Y },
            ],
            aims: [{ from: 3.0, to: 6.0, at: 'blue' }],
            shots: [{ t: 4.6, target: 'blue', hit: false }, { t: 5.2, target: 'blue', hit: false }],
        },
        {
            id: 'green', look: 'green', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 400, y: TOP_Y },
                { t: 2.0, x: 470, y: TOP_Y },
                { t: 4.0, x: 470, y: TOP_Y },
                { t: 6.0, x: 400, y: TOP_Y },
                { t: 8, x: 400, y: TOP_Y },
            ],
            aims: [{ from: 2.0, to: 4.1, at: 'red' }],
            shots: [2.8, 3.2, 3.6, 3.9].map(t => ({ t, target: 'red', hit: true })),
        },
        {
            id: 'red', look: 'red', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 780, y: LOW_Y },
                { t: 1.5, x: 780, y: LOW_Y },
                { t: 3.0, x: 650, y: LOW_Y },
                { t: 7.4, x: 780, y: LOW_Y },
                { t: 8, x: 780, y: LOW_Y },
            ],
            aims: [{ from: 2.0, to: 4.1, at: 'green' }],
            shots: [{ t: 2.6, target: 'green', hit: false }, { t: 3.3, target: 'green', hit: false }],
            death: { at: 4.1, respawn: 7.4, killer: 'green' },
        },
        {
            id: 'blue', look: 'blue', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 660, y: FLOOR_Y },
                { t: 3.0, x: 520, y: FLOOR_Y },
                { t: 6.0, x: 520, y: FLOOR_Y },
                { t: 8, x: 660, y: FLOOR_Y },
            ],
            aims: [{ from: 3.5, to: 6.0, at: 'you' }],
            shots: [{ t: 4.2, target: 'you', hit: false }],
        },
    ],
};
