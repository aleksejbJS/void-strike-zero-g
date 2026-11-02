// Deathmatch loop (5 s): you jetpack off the left deck and gun down the red bot on the right;
// it ragdolls, respawns on the floor and flies back up. Blue patrols the top, green the floor.

import { Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { FLOOR_Y, LOW_Y, TOP_Y } from '../previewWorld';

const MG = WeaponType.MACHINE_GUN;

export const deathmatchScript: ModeScript = {
    duration: 5,
    actors: [
        {
            id: 'you', look: 'you', team: Team.NONE, weapon: MG, label: true,
            keys: [
                { t: 0, x: 180, y: LOW_Y },
                { t: 0.5, x: 180, y: LOW_Y, move: 'jet' },
                { t: 1.3, x: 290, y: 215, move: 'jet' },
                { t: 2.4, x: 320, y: 200, move: 'fall' },
                { t: 3.0, x: 240, y: LOW_Y },
                { t: 3.6, x: 180, y: LOW_Y },
                { t: 5, x: 180, y: LOW_Y },
            ],
            aims: [{ from: 0, to: 2.4, at: 'red' }, { from: 3.6, to: 5, at: 'red' }],
            shots: [1.0, 1.2, 1.4, 1.6, 1.8].map(t => ({ t, target: 'red', hit: true })),
        },
        {
            id: 'red', look: 'red', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 720, y: LOW_Y },
                { t: 1.9, x: 720, y: LOW_Y },
                { t: 3.4, x: 780, y: FLOOR_Y },
                { t: 3.8, x: 780, y: FLOOR_Y, move: 'jet' },
                { t: 4.6, x: 720, y: LOW_Y },
                { t: 5, x: 720, y: LOW_Y },
            ],
            aims: [{ from: 0.4, to: 1.9, at: 'you' }, { from: 4.6, to: 5, at: { x: 0, y: LOW_Y - 49 } }],
            shots: [0.8, 1.15, 1.5].map(t => ({ t, target: 'you', hit: false })),
            death: { at: 1.9, respawn: 3.4, killer: 'you' },
        },
        {
            id: 'blue', look: 'blue', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 370, y: TOP_Y },
                { t: 2.5, x: 520, y: TOP_Y },
                { t: 5, x: 370, y: TOP_Y },
            ],
        },
        {
            id: 'green', look: 'green', team: Team.NONE, weapon: MG,
            keys: [
                { t: 0, x: 560, y: FLOOR_Y },
                { t: 2.5, x: 430, y: FLOOR_Y },
                { t: 5, x: 560, y: FLOOR_Y },
            ],
        },
    ],
};
