// Infiltration loop (7 s): you jetpack onto the red deck, grab the intel case and fly it low
// across the gap to the extraction zone on the left deck; the red guard misses, a blue teammate on
// the top deck takes him out. After the extraction you slip back unseen and the case returns.

import { ItemType, Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { FLOOR_Y, LOW_Y, TOP_Y } from '../previewWorld';

const MG = WeaponType.MACHINE_GUN;
const GRAB = 1.2;
const EXTRACT = 4.7;

/** Extraction zone over the left deck, in world px (drawn as an HTML overlay). */
export const EXTRACTION = { x: 80, y: LOW_Y - 90, w: 170, h: 90 };

export const infiltrationScript: ModeScript = {
    duration: 7,
    props: [{ id: 'intel', type: ItemType.INTEL, team: Team.RED, pos: { x: 740, y: LOW_Y - 26 }, hidden: [{ from: GRAB, to: EXTRACT }] }],
    texts: [{ t: EXTRACT, actor: 'you', text: '+1', color: '#86EFAC' }],
    actors: [
        {
            id: 'you', look: 'you', team: Team.BLUE, weapon: MG, label: true,
            carry: [{ from: GRAB, to: EXTRACT, team: Team.RED }],
            keys: [
                { t: 0, x: 520, y: FLOOR_Y },
                { t: 0.5, x: 620, y: FLOOR_Y },
                { t: 0.6, x: 620, y: FLOOR_Y, move: 'jet' },
                { t: GRAB, x: 740, y: LOW_Y },
                // Low across the gap under the top deck, where the goal banner never covers it
                { t: 1.4, x: 740, y: LOW_Y, move: 'jet' },
                { t: 2.0, x: 590, y: 282, move: 'jet' },
                { t: 3.5, x: 300, y: 282, move: 'fall' },
                { t: 4.1, x: 200, y: LOW_Y },
                { t: EXTRACT, x: 160, y: LOW_Y },
                { t: 5.3, x: 160, y: LOW_Y },
                { t: 6.6, x: 520, y: FLOOR_Y },
                { t: 7, x: 520, y: FLOOR_Y },
            ],
            hide: { from: 5.3, to: 6.6 },
        },
        {
            id: 'guard', look: 'red', team: Team.RED, weapon: MG,
            keys: [{ t: 0, x: 810, y: LOW_Y }, { t: 7, x: 810, y: LOW_Y }],
            aims: [{ from: 0, to: 2.6, at: 'you' }],
            shots: [1.0, 1.6, 2.2].map(t => ({ t, target: 'you', hit: false })),
            death: { at: 2.6, respawn: 5.0, killer: 'mate' },
        },
        {
            id: 'mate', look: 'blue', team: Team.BLUE, weapon: MG,
            keys: [{ t: 0, x: 400, y: TOP_Y }, { t: 7, x: 400, y: TOP_Y }],
            aims: [{ from: 1.4, to: 2.7, at: 'guard' }, { from: 5.0, to: 7, at: 'guard' }],
            shots: [1.9, 2.2, 2.45].map(t => ({ t, target: 'guard', hit: true })),
        },
    ],
};
