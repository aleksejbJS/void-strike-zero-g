import type { Vector2 } from '../../../types';

// Atlas alpha QA includes the rounded painted joint ends and the complete closed fists.
export const PRONE_SUPPORT = { joint: 4.5, hand: 3.5 } as const;

export const proneBodyFrame = (phase: number) => {
    const crawl = Math.sin(phase);
    return {
        hip: { x: -15, y: -13 + Math.abs(crawl) * 0.6 },
        lean: 1.38,
        feet: [{ x: -44 + crawl * 3, y: -2 }, { x: -42 - crawl * 3, y: -3.5 }],
        lift: 0,
    };
};

/** Raise the complete weapon assembly only when a grip would bury the painted fist. */
export const proneWeaponLift = (grips: readonly Vector2[]): number =>
    Math.max(0, ...grips.map(point => point.y + PRONE_SUPPORT.hand));
