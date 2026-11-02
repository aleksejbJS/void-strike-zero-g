// Looks for bots in free-for-all modes: each bot wears a different skin preset with a random
// flame, pattern and badge, so fighters can be told apart when there are no teams.
// Pure data, no browser imports, so the room can use it on the server too.

import { SKINS } from '../../constants';
import { BADGES, EMBLEMS, FLAMES, FighterBuild, PATTERNS } from './buildParts';
import { presetBuild } from './buildPresets';

export interface BotLook {
    skinId: string;
    color: string;
    headColor: string;
    torsoColor: string;
    armColor: string;
    legColor: string;
    jetpackColor: string;
    build: FighterBuild;
}

type Rng = () => number;

const MAX_BADGE_NUMBER = 99;

const pickOne = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

const shuffled = <T>(list: readonly T[], rng: Rng): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/** The preset keeps its colours and silhouette; only the decoration is rolled. */
const withRandomParts = (build: FighterBuild, rng: Rng): FighterBuild => ({
    ...build,
    flame: pickOne(FLAMES, rng),
    pattern: pickOne(PATTERNS, rng),
    badge: pickOne(BADGES, rng),
    badgeNumber: Math.floor(rng() * (MAX_BADGE_NUMBER + 1)),
    emblem: pickOne(EMBLEMS, rng),
});

/** One look per bot; skins repeat only after all of them are used. */
export const ffaBotLooks = (count: number, rng: Rng = Math.random): BotLook[] => {
    const skins = shuffled(SKINS, rng);
    return Array.from({ length: count }, (_, i) => {
        const skin = skins[i % skins.length];
        const { head, torso, arms, legs, jetpack } = skin.palette;
        return {
            skinId: skin.id, color: skin.color,
            headColor: head, torsoColor: torso, armColor: arms, legColor: legs, jetpackColor: jetpack,
            build: withRandomParts(presetBuild(skin.id), rng),
        };
    });
};
