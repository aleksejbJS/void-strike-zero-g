// Smoke clouds: a cloud hides whatever stands in it and whatever is seen through it.
// Created and expired by the authoritative simulation; readers only ask the questions below.

import { GameState, SmokeCloud, Vector2 } from '../../types';
import { nextId } from '../utils/id';

export const SMOKE_DURATION_MS = 10000;
export const SMOKE_FADE_MS = 2000; // last part of the lifetime: the cloud shrinks to nothing
export const SMOKE_RADIUS = 110;
export const MAX_SMOKES = 12;

/** Add a cloud at `pos`; the oldest one goes when the cap is reached. */
export const spawnSmoke = (state: GameState, pos: Vector2, now: number): SmokeCloud => {
    const smokes = state.smokes ?? (state.smokes = []);
    const cloud: SmokeCloud = {
        id: nextId('smoke_'),
        pos: { x: pos.x, y: pos.y },
        radius: SMOKE_RADIUS,
        bornAt: now,
        endsAt: now + SMOKE_DURATION_MS,
    };
    smokes.push(cloud);
    while (smokes.length > MAX_SMOKES) smokes.shift();
    return cloud;
};

/** Remove clouds whose time is up. */
export const updateSmokes = (state: GameState, now: number): void => {
    if (!state.smokes) return;
    state.smokes = state.smokes.filter(c => now < c.endsAt);
};

/** Live size: full until the fade starts, then linear down to 0 at `endsAt`. */
export const smokeRadiusAt = (cloud: SmokeCloud, now: number): number => {
    const fadeStart = cloud.endsAt - SMOKE_FADE_MS;
    if (now <= fadeStart) return cloud.radius;
    if (now >= cloud.endsAt) return 0;
    return cloud.radius * (cloud.endsAt - now) / SMOKE_FADE_MS;
};

const distToSegment = (p: Vector2, a: Vector2, b: Vector2): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const contains = (cloud: SmokeCloud, point: Vector2, now: number): boolean => {
    const r = smokeRadiusAt(cloud, now);
    return r > 0 && Math.hypot(point.x - cloud.pos.x, point.y - cloud.pos.y) <= r;
};

export const insideSmoke = (state: GameState, point: Vector2, now: number): boolean =>
    (state.smokes ?? []).some(c => contains(c, point, now));

/**
 * True if smoke hides `to` from `from`: `to` stands in a cloud, or the line of sight crosses a
 * cloud that `from` is not in. A viewer inside a cloud still sees out of it.
 */
export const smokeHides = (state: GameState, from: Vector2, to: Vector2, now: number): boolean =>
    (state.smokes ?? []).some(c => {
        const r = smokeRadiusAt(c, now);
        if (r <= 0) return false; // fully faded
        if (contains(c, to, now)) return true;
        if (contains(c, from, now)) return false;
        return distToSegment(c.pos, from, to) <= r;
    });
