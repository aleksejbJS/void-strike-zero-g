// The centre line of each tail as a chain of equal segments, bent by the part motion springs. Pure maths.
// Rig space: +x is the way the fighter faces, y grows downward, angles are measured from +x (so π points back).

import { Vector2 } from '../../../../types';
import { TailId } from '../../../build/buildParts';
import { PartMotionFrame } from './partMotionFrame';

export type ShapedTail = Exclude<TailId, 'none'>;

interface TailChain {
    rest: number[];   // direction of every segment at rest, root first (radians)
    seg: number;      // segment length, rig units
    stretch: number;  // direction every segment heads for when swept fully back
    wave: number;     // wriggle swing at the tip, radians
    lag: number;      // how far the wriggle trails per segment, radians: higher = wavier
}

// Rest shapes traced from the approved mockup (scaled to the rig: mockup head 26 = rig head 8.6).
const CHAINS: Record<ShapedTail, TailChain> = {
    // Long S-curve: down and back from the body, then curling up with the tip leaning forward.
    cat: { rest: [2.69, 2.92, -2.89, -2.12, -1.57, -1.14, -0.67], seg: 4.7, stretch: -2.95, wave: 0.16, lag: 0.55 },
    // Thin and long, an easy arc; the wriggle makes the waves.
    tentacle: {
        rest: [2.75, 2.95, 3.1, -3.06, -2.94, -2.82, -2.7, -2.6, -2.5, -2.4], seg: 2.7, stretch: -3.04, wave: 0.55, lag: 0.8,
    },
    // Thick, nearly straight and falling gently; stiff, so the whole tail whips.
    lizard: { rest: [2.96, 2.9, 2.84, 2.79, 2.74, 2.7, 2.67, 2.65], seg: 3.5, stretch: 3.1, wave: 0.3, lag: 0.3 },
    // Five links back and up to the light; a stiff chain.
    mech: { rest: [2.75, 3.06, -2.79, -2.36, -2.13], seg: 4, stretch: -3.0, wave: 0.12, lag: 0.25 },
};

const BEND_FOLLOW = 0.85;  // share of the way to the swept-back line at full bend
const TUCK = 0.45;         // radians the root swings down when the air pushes the tail forward (bend < 0)
const LIFT = 0.7;          // radians the root rises at full lift; the tip follows less
const LIFT_TIP = 0.6;      // share of the lift the tip loses
const WAVE_ROOT = 0.3;     // share of the tip's wriggle the root keeps

/** The shortest signed turn from angle a to angle b. */
const turn = (a: number, b: number) => {
    const d = (b - a) % (2 * Math.PI);
    return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

/** The direction of segment i (t = 0 at the root, 1 at the tip) for this motion frame. */
const segmentAngle = (c: TailChain, i: number, m: PartMotionFrame) => {
    const t = c.rest.length > 1 ? i / (c.rest.length - 1) : 0;
    let a = c.rest[i];
    if (m.tailBend >= 0) a += turn(a, c.stretch) * Math.min(1, m.tailBend) * BEND_FOLLOW;
    else a -= Math.min(1, -m.tailBend) * TUCK * (1 - t / 2);
    a += m.tailLift * LIFT * (1 - LIFT_TIP * t);
    return a + c.wave * (WAVE_ROOT + (1 - WAVE_ROOT) * t) * Math.sin(m.tailWave - i * c.lag);
};

/** The bent centre line of a tail from its root to its tip (empty for no tail). The length never changes. */
export const tailPoints = (tail: TailId, root: Vector2, m: PartMotionFrame): Vector2[] => {
    if (tail === 'none') return [];
    const c = CHAINS[tail];
    if (!c) return []; // unknown id: last guard, builds are sanitized upstream
    const pts: Vector2[] = [{ ...root }];
    c.rest.forEach((_, i) => {
        const a = segmentAngle(c, i, m), p = pts[i];
        pts.push({ x: p.x + Math.cos(a) * c.seg, y: p.y + Math.sin(a) * c.seg });
    });
    return pts;
};
