// Capture the Flag loop (6 s): you grab the red flag on the right deck and jetpack it over the
// top to the blue base on the left; a red chaser shoots after you until the blue defender
// drops him. After the capture you slip back unseen and the red flag is home again.

import { ItemType, Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { LOW_Y } from '../previewWorld';

const MG = WeaponType.MACHINE_GUN;
export const BLUE_BASE_X = 110;
export const RED_BASE_X = 776;
const GRAB = 0.5;
const CAPTURE = 4.3;

export const ctfScript: ModeScript = {
    duration: 6,
    props: [
        { id: 'blue-flag', type: ItemType.FLAG, team: Team.BLUE, pos: { x: BLUE_BASE_X, y: LOW_Y - 30 } },
        { id: 'red-flag', type: ItemType.FLAG, team: Team.RED, pos: { x: RED_BASE_X, y: LOW_Y - 30 }, hidden: [{ from: GRAB, to: CAPTURE }] },
    ],
    texts: [{ t: CAPTURE, actor: 'you', text: '+1', color: '#93C5FD' }],
    actors: [
        {
            id: 'you', look: 'you', team: Team.BLUE, weapon: MG, label: true,
            carry: [{ from: GRAB, to: CAPTURE, team: Team.RED }],
            keys: [
                { t: 0, x: 730, y: LOW_Y },
                { t: GRAB, x: RED_BASE_X, y: LOW_Y },
                { t: 0.7, x: RED_BASE_X, y: LOW_Y, move: 'jet' },
                { t: 1.8, x: 590, y: 140, move: 'jet' },
                { t: 3.0, x: 320, y: 140, move: 'fall' },
                { t: 3.7, x: 170, y: LOW_Y },
                { t: CAPTURE, x: BLUE_BASE_X + 20, y: LOW_Y },
                { t: 4.8, x: BLUE_BASE_X + 20, y: LOW_Y },
                { t: 5.6, x: 730, y: LOW_Y },
                { t: 6, x: 730, y: LOW_Y },
            ],
            hide: { from: 4.8, to: 5.6 },
        },
        {
            id: 'chaser', look: 'red', team: Team.RED, weapon: MG,
            keys: [
                { t: 0, x: 680, y: LOW_Y },
                { t: 0.9, x: 680, y: LOW_Y, move: 'jet' },
                { t: 2.1, x: 600, y: 150, move: 'jet' },
                { t: 3.1, x: 430, y: 150 },
                { t: 5.0, x: 680, y: LOW_Y },
                { t: 6, x: 680, y: LOW_Y },
            ],
            aims: [{ from: 0.9, to: 3.1, at: 'you' }],
            shots: [1.3, 1.9, 2.5].map(t => ({ t, target: 'you', hit: false })),
            death: { at: 3.1, respawn: 5.0, killer: 'defender' },
        },
        {
            id: 'defender', look: 'blue', team: Team.BLUE, weapon: MG,
            keys: [{ t: 0, x: 240, y: LOW_Y }, { t: 6, x: 240, y: LOW_Y }],
            aims: [{ from: 1.6, to: 3.2, at: 'chaser' }],
            shots: [2.2, 2.5, 2.8].map(t => ({ t, target: 'chaser', hit: true })),
        },
    ],
};
