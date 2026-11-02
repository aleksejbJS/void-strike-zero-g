// Gun Game loop (6 s): every kill moves you up the ladder — a shotgun kill on red, a rocket
// for blue in the air, a railgun beam through green on the floor. The ladder strip over the
// scene follows the same switches (GUN_GAME_STEPS).

import { Team, WeaponType } from '../../../../types';
import { ModeScript } from '../previewScript';
import { FLOOR_Y, LOW_Y, TOP_Y } from '../previewWorld';

/** When you switch weapon, and the ladder rung (0 = machine gun) highlighted from then on. */
export const GUN_GAME_STEPS: { t: number; weapon: WeaponType; rung: number }[] = [
    { t: 0, weapon: WeaponType.SHOTGUN, rung: 1 },
    { t: 1.6, weapon: WeaponType.ROCKET_LAUNCHER, rung: 3 },
    { t: 3.2, weapon: WeaponType.RAILGUN, rung: 5 },
];

export const GUN_GAME_LOOP = 6;

export const gunGameScript: ModeScript = {
    duration: GUN_GAME_LOOP,
    actors: [
        {
            id: 'you', look: 'you', team: Team.NONE, weapon: WeaponType.SHOTGUN, label: true,
            weapons: GUN_GAME_STEPS.slice(1).map(({ t, weapon }) => ({ t, weapon })),
            keys: [
                { t: 0, x: 170, y: LOW_Y },
                { t: 1.6, x: 170, y: LOW_Y },
                { t: 2.0, x: 240, y: LOW_Y },
                { t: 3.4, x: 240, y: LOW_Y },
                { t: 4.4, x: 170, y: LOW_Y },
                { t: 6, x: 170, y: LOW_Y },
            ],
            aims: [{ from: 0, to: 1.6, at: 'red' }, { from: 1.6, to: 3.2, at: 'blue' }, { from: 3.2, to: 4.4, at: 'green' }, { from: 4.4, to: 6, at: 'red' }],
            shots: [
                { t: 0.5, target: 'red', hit: true },
                { t: 1.0, target: 'red', hit: true },
                { t: 2.3, target: 'blue', hit: true },
                { t: 3.8, target: 'green', hit: true },
            ],
        },
        {
            id: 'red', look: 'red', team: Team.NONE, weapon: WeaponType.SHOTGUN,
            keys: [{ t: 0, x: 730, y: LOW_Y }, { t: 6, x: 730, y: LOW_Y }],
            aims: [{ from: 0, to: 6, at: 'you' }],
            shots: [{ t: 0.7, target: 'you', hit: false }, { t: 5.2, target: 'you', hit: false }],
            death: { at: 1.3, respawn: 3.0, killer: 'you' },
        },
        {
            id: 'blue', look: 'blue', team: Team.NONE, weapon: WeaponType.SHOTGUN,
            keys: [
                { t: 0, x: 420, y: TOP_Y },
                { t: 1.7, x: 420, y: TOP_Y, move: 'jet' },
                { t: 2.6, x: 470, y: 110 },
                { t: 4.6, x: 420, y: TOP_Y },
                { t: 6, x: 420, y: TOP_Y },
            ],
            death: { at: 2.6, respawn: 4.6, killer: 'you' },
        },
        {
            id: 'green', look: 'green', team: Team.NONE, weapon: WeaponType.SHOTGUN,
            keys: [
                { t: 0, x: 620, y: FLOOR_Y },
                { t: 3.85, x: 470, y: FLOOR_Y },
                { t: 5.4, x: 620, y: FLOOR_Y },
                { t: 6, x: 620, y: FLOOR_Y },
            ],
            death: { at: 3.85, respawn: 5.4, killer: 'you' },
        },
    ],
};
