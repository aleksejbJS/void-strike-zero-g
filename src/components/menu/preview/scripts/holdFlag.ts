// Hold the Flag loop (6 s): a red bot holds the burning flag on the top deck and scores while
// it lives; you and a blue teammate jetpack in from both sides and pour fire on him; he drops
// your teammate, who respawns on his deck.

import { Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { LOW_Y, TOP_Y } from '../previewWorld';

const MG = WeaponType.MACHINE_GUN;
const RED_TEXT = '#FCA5A5';

export const holdFlagScript: ModeScript = {
    duration: 6,
    texts: [1.0, 2.5, 4.0, 5.5].map(t => ({ t, actor: 'holder', text: '+1', color: RED_TEXT })),
    actors: [
        {
            id: 'holder', look: 'red', team: Team.RED, weapon: MG,
            carry: [{ from: 0, to: 6, team: Team.RED }],
            keys: [
                { t: 0, x: 430, y: TOP_Y },
                { t: 3, x: 460, y: TOP_Y },
                { t: 6, x: 430, y: TOP_Y },
            ],
            aims: [{ from: 0, to: 2.4, at: 'you' }, { from: 2.4, to: 3.1, at: 'mate' }, { from: 3.1, to: 6, at: 'you' }],
            shots: [
                { t: 1.2, target: 'you', hit: false },
                { t: 1.8, target: 'you', hit: false },
                { t: 2.6, target: 'mate', hit: true },
                { t: 2.8, target: 'mate', hit: true },
                { t: 4.5, target: 'you', hit: false },
            ],
        },
        {
            id: 'you', look: 'you', team: Team.BLUE, weapon: MG, label: true,
            keys: [
                { t: 0, x: 150, y: LOW_Y },
                { t: 0.8, x: 150, y: LOW_Y, move: 'jet' },
                { t: 2.0, x: 250, y: 165, move: 'jet' },
                { t: 3.4, x: 270, y: 150, move: 'fall' },
                { t: 4.2, x: 190, y: LOW_Y },
                { t: 5.0, x: 150, y: LOW_Y },
                { t: 6, x: 150, y: LOW_Y },
            ],
            aims: [{ from: 0, to: 6, at: 'holder' }],
            shots: [1.6, 2.0, 2.4, 2.8, 3.2].map(t => ({ t, target: 'holder', hit: true })),
        },
        {
            id: 'mate', look: 'blue', team: Team.BLUE, weapon: MG,
            keys: [
                { t: 0, x: 740, y: LOW_Y },
                { t: 1.2, x: 740, y: LOW_Y, move: 'jet' },
                { t: 2.6, x: 630, y: 150 },
                { t: 5.0, x: 740, y: LOW_Y },
                { t: 6, x: 740, y: LOW_Y },
            ],
            aims: [{ from: 1.2, to: 3.0, at: 'holder' }],
            shots: [{ t: 2.1, target: 'holder', hit: true }, { t: 2.5, target: 'holder', hit: true }],
            death: { at: 3.0, respawn: 5.0, killer: 'holder' },
        },
    ],
};
