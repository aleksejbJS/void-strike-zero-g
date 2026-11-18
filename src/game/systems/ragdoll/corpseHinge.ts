// Knees and elbows of a corpse bend one way only, like real hinge joints. Verlet, no motors: a joint
// bent the wrong way is moved back onto the straight line between its two ends. Pure math on the corpse.

import type { Corpse, CorpsePointId } from './corpseBody';

/**
 * [upper end, joint, lower end, way]. `way` is the sign of the allowed bend (2D cross product of the
 * two bones, y down) for a body facing right: a knee folds the shin back, an elbow folds the forearm
 * forward. The cross product keeps its sign when the body turns or flips upside down; only a mirror
 * (facing left) flips it.
 */
export type Hinge = readonly [CorpsePointId, CorpsePointId, CorpsePointId, 1 | -1];

export const HINGES: readonly Hinge[] = [
    ['hip', 'knF', 'anF', 1], ['hip', 'knB', 'anB', 1],
    ['shF', 'elF', 'haF', -1], ['shB', 'elB', 'haB', -1],
];

/** Ends closer than this (squared) give the joint no line to return to. */
const MIN_SPAN_SQ = 1e-6;

// Tearing a corpse (gib, cut, torn leg) always replaces its links array, so the array is a safe cache key
const cache = new WeakMap<Corpse['links'], Hinge[]>();

/** The hinges whose two bones are both still attached: a gib, a railgun cut or a torn leg removes some. */
export const activeHinges = (c: Corpse): Hinge[] => {
    const cached = cache.get(c.links);
    if (cached) return cached;
    const bones = new Set<string>();
    for (const l of c.links) {
        if (l.min) continue; // a joint limit is not a bone
        bones.add(`${l.a}|${l.b}`);
        bones.add(`${l.b}|${l.a}`);
    }
    const hinges = HINGES.filter(([a, b, d]) => bones.has(`${a}|${b}`) && bones.has(`${b}|${d}`));
    cache.set(c.links, hinges);
    return hinges;
};

/** How far the hinge bends the allowed way (cross product of its bones); negative = bent the wrong way. */
export const hingeBend = (c: Corpse, [a, b, d, way]: Hinge): number => {
    const A = c.points[a], B = c.points[b], D = c.points[d];
    return ((B.x - A.x) * (D.y - B.y) - (B.y - A.y) * (D.x - B.x)) * way * c.facing;
};

/**
 * Put every joint bent the wrong way back on the line between its ends (the limb goes straight; the
 * links keep the bone lengths). The joint moves 2/3 of its offset, the two ends 1/3 the other way,
 * so the body as a whole gains no speed (all points weigh the same).
 */
export const bendHinges = (c: Corpse, hinges: readonly Hinge[]): void => {
    for (const hinge of hinges) {
        if (hingeBend(c, hinge) >= 0) continue;
        const A = c.points[hinge[0]], B = c.points[hinge[1]], D = c.points[hinge[2]];
        const ex = D.x - A.x, ey = D.y - A.y;
        const span = ex * ex + ey * ey;
        if (span < MIN_SPAN_SQ) continue;
        const t = ((B.x - A.x) * ex + (B.y - A.y) * ey) / span;
        // The joint's offset from the line A–D
        const hx = B.x - A.x - t * ex, hy = B.y - A.y - t * ey;
        B.x -= hx * 2 / 3; B.y -= hy * 2 / 3;
        A.x += hx / 3; A.y += hy / 3;
        D.x += hx / 3; D.y += hy / 3;
    }
};
