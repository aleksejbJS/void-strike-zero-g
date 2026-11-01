// Several effect views (projectiles, particles, beams) stack their containers at the top of
// one layer. Anything else added to the layer later (respawned fighters, ragdolls, texts)
// would cover them, so each view calls keepOnTop every frame. The containers of the other
// effect views do not count as "something else": without that, each view would shove itself
// above the previous one every frame and the stack order would be rebuilt 60 times a second.

import { Container } from 'pixi.js';

const effectContainers = new WeakSet<Container>();

/** Make `own` (bottom to top) the last children of `layer`, moving them only if a foreign child sits above. */
export const keepOnTop = (layer: Container, own: Container[]): void => {
    const first = own[0];
    if (first.parent === layer) {
        const kids = layer.children;
        let covered = false;
        // Walk down from the top until our own bottom container; the walk is as long as the effect stack
        for (let i = kids.length - 1; kids[i] !== first; i--) {
            if (!effectContainers.has(kids[i])) { covered = true; break; }
        }
        if (!covered) return;
    }
    for (const c of own) effectContainers.add(c);
    layer.addChild(...own);
};
