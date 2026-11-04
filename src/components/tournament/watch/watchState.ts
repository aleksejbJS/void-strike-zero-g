// The world a tile draws before the host's first snapshot arrives: nothing in it yet.
// Mode and map are placeholders; the host's snapshot overwrites them.

import { GameMode, GameState, MapId, Team } from '../../../types';

export const emptyWatchState = (): GameState => ({
    mode: GameMode.DEATHMATCH,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    decals: [],
    floatingTexts: [],
    platforms: [],
    pickups: [],
    camera: { x: 0, y: 0, zoom: 1 },
    corpses: [],
    currentMap: MapId.DEFAULT,
    beams: [],
    smokes: [],
});
