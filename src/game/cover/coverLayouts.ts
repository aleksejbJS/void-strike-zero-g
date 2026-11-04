// Cover placement data, one list per platform layout (data only, see coverLayout.ts).
// Entry = [kind, x, y]: x is the object's centre, y the top of the platform it stands on.
// Source: docs/plans/2026-11-04-destructible-cover-spec.md, "Placement", with its known fixes.

import type { CoverKind } from './coverTypes';

export type CoverLayoutKey = 'dm' | 'tunnels' | 'hunger' | 'ctf' | 'htf' | 'infiltration';
export type CoverEntry = readonly [kind: CoverKind, x: number, y: number];

export const COVER_LAYOUTS: Record<CoverLayoutKey, readonly CoverEntry[]> = {
    dm: [
        ['wood', -850, 700], ['wood', 2850, 700], ['wood', 700, 700], ['wood', 1300, 700],
        ['wood', 400, 900], ['wood', 1600, 900],
        ['metal', 1000, 900], ['metal', -1130, -100], ['metal', 2630, -100],
        ['glass', 720, 250], ['glass', 1280, 250],
        ['barrel', -500, 900], ['barrel', 2500, 900],
    ],
    tunnels: [
        ['wood', -1400, 900], ['wood', 3400, 900], ['wood', 700, 200], ['wood', 1300, 200],
        ['wood', 2450, 400], ['wood', 2750, 200], ['wood', -230, 450],
        ['metal', 860, 900], ['metal', 1140, 900], ['metal', 830, -400], ['metal', 1170, -400],
        ['metal', -430, -50],
        ['glass', -320, -600], ['glass', 2620, -600],
        ['barrel', 20, 900], ['barrel', 2020, 900], ['barrel', 2750, 600],
    ],
    hunger: [
        ['wood', -960, 1400], ['wood', 2160, 1400], ['wood', -300, 1200], ['wood', 1100, 1200],
        ['wood', -1550, 300], ['wood', 2850, 300],
        ['metal', -1950, -200], ['metal', 3150, -200], ['metal', 910, -900],
        ['metal', -1710, 1300], ['metal', 3010, 1300],
        ['glass', -40, 900], ['glass', 1040, 900],
        ['barrel', 1500, 1400], ['barrel', 431, 1200], ['barrel', 561, 600],
        ['barrel', -2169, 800], ['barrel', 3369, 800],
    ],
    ctf: [
        ['wood', 300, 800], ['wood', 1700, 800], ['wood', -800, 800], ['wood', 2800, 800],
        ['wood', 925, -200], ['wood', 1075, -200],
        ['metal', -245, 500], ['metal', 2245, 500],
        ['glass', 820, 600], ['glass', 1180, 600],
        ['barrel', 1000, 800],
    ],
    htf: [
        ['wood', 300, 800], ['wood', 1700, 800], ['wood', 995, 550], ['wood', 1205, 550],
        ['wood', 640, 300], ['wood', 1760, 300], ['wood', 1000, -200],
        ['metal', -230, 500], ['metal', 2230, 500],
    ],
    infiltration: [
        ['wood', 1445, 500], ['wood', 1755, 500], ['wood', 845, 350],
        ['wood', 0, 800], ['wood', 1100, 800], ['wood', 2000, 800],
        ['metal', 2630, 600], ['metal', 2530, 400], ['metal', 2630, 200],
        ['glass', 2610, 0],
        ['barrel', 1600, 800], ['barrel', 3050, 600], ['barrel', 600, 800],
    ],
};
