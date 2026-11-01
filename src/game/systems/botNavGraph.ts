// Navigation graph for bots, built once per map from its platforms: where a fighter can stand
// (surfaces) and how to get between them (walk, drop, jetpack, grapple hook).
// Reach limits come from measuring the real physics (see botNav.test.ts).

import { GameState, Platform, Vector2 } from '../../types';
import { HOOK_MIN_LENGTH, HOOK_RANGE } from '../../constants';
import { castRay } from './combat';

export interface NavNode { id: number; x0: number; x1: number; y: number }
export type EdgeKind = 'walk' | 'drop' | 'jet' | 'hook';
export interface NavEdge {
    from: number;
    to: number;
    kind: EdgeKind;
    cost: number;     // seconds, roughly
    startX: number;   // where on the start surface the move begins
    endX: number;     // where on the target surface it lands
    anchor?: Vector2; // hook: the point to fire at
}
export interface NavGraph { nodes: NavNode[]; edges: NavEdge[]; out: NavEdge[][] }

const BODY_H = 74, HALF_W = 16, MIN_SURFACE = 30;
const RUN_PX_S = 240;
const FALL_PX_PER_TICK2 = 0.09;              // y ≈ 0.09·t² px after t ticks of free fall (120 ticks/s)
// Measured on a full tank: 300 px straight up, but 545 px with side thrust (it burns less fuel) —
// also when zigzagging in place (only ~130 px drift). Bots always climb with side thrust.
export const JET_RISE = 490; // 90% of the measured climb
export const HOP_RISE = 240;  // a straight-up hop from a surface (300 px measured on a full tank)
const JET_SIDE_MAX = 520;
const HOOK_REACH = HOOK_RANGE - 30;

export const solidAt = (platforms: Platform[], x: number, y: number) =>
    platforms.some(p => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h);

/** A straight segment is free of platform bodies (sampled every 8 px). */
export const segmentClear = (platforms: Platform[], a: Vector2, b: Vector2) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let i = 0; i <= steps; i++) if (solidAt(platforms, a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)) return false;
    return true;
};

/** Platform tops minus the parts with something solid right above (no room to stand). */
const buildSurfaces = (platforms: Platform[]): NavNode[] => {
    const nodes: NavNode[] = [];
    for (const p of platforms) {
        if (p.w < MIN_SURFACE) continue;
        let pieces: [number, number][] = [[p.x, p.x + p.w]];
        for (const q of platforms) {
            if (q === p || !(q.y < p.y && q.y + q.h > p.y - BODY_H)) continue;
            const b0 = q.x - HALF_W, b1 = q.x + q.w + HALF_W;
            pieces = pieces.flatMap(([a, b]) => (b1 <= a || b0 >= b ? [[a, b] as [number, number]] : [[a, Math.min(b, b0)], [Math.max(a, b1), b]].filter(([s, e]) => e - s > 0) as [number, number][]));
        }
        pieces.filter(([a, b]) => b - a >= MIN_SURFACE).forEach(([x0, x1]) => nodes.push({ id: nodes.length, x0, x1, y: p.y }));
    }
    return mergeOverlaps(nodes);
};

/** Platforms overlapping at the same height make one surface (else a bot can't tell which it is on). */
const mergeOverlaps = (nodes: NavNode[]): NavNode[] => {
    const merged: NavNode[] = [];
    for (const n of [...nodes].sort((a, b) => a.y - b.y || a.x0 - b.x0)) {
        const last = merged[merged.length - 1];
        if (last && last.y === n.y && n.x0 < last.x1) last.x1 = Math.max(last.x1, n.x1);
        else merged.push({ ...n });
    }
    return merged.map((n, id) => ({ ...n, id }));
};

/** The first surface a fighter lands on when falling straight down at x from y. */
export const surfaceBelow = (nodes: NavNode[], x: number, y: number) => {
    let best: NavNode | null = null;
    for (const n of nodes) if (x >= n.x0 && x <= n.x1 && n.y >= y - 2 && (!best || n.y < best.y)) best = n;
    return best;
};

const addWalks = (nodes: NavNode[], edges: NavEdge[]) => {
    for (const a of nodes) for (const b of nodes) {
        if (a === b || Math.abs(a.y - b.y) > 6) continue;
        if (Math.abs(a.x1 - b.x0) <= 4) edges.push({ from: a.id, to: b.id, kind: 'walk', cost: 0.05, startX: a.x1 - 2, endX: b.x0 + 2 });
    }
};

const addDrops = (nodes: NavNode[], platforms: Platform[], edges: NavEdge[]) => {
    for (const a of nodes) for (const dir of [-1, 1]) {
        const edgeX = dir < 0 ? a.x0 : a.x1;
        const seen = new Set<number>();
        for (const off of [24, 70, 140, 220, 320]) {
            const x = edgeX + dir * off;
            if (!segmentClear(platforms, { x: edgeX, y: a.y - BODY_H / 2 }, { x, y: a.y - BODY_H / 2 })) break;
            const b = surfaceBelow(nodes, x, a.y + 4);
            if (!b || b.id === a.id || seen.has(b.id) || b.y <= a.y + 8) continue;
            const fallTicks = Math.sqrt((b.y - a.y) / FALL_PX_PER_TICK2);
            if (off > 40 + (fallTicks / 120) * RUN_PX_S) continue;          // can't carry that far in the air
            if (!segmentClear(platforms, { x, y: a.y - 10 }, { x, y: b.y - 4 })) continue;
            seen.add(b.id);
            edges.push({ from: a.id, to: b.id, kind: 'drop', cost: off / RUN_PX_S + fallTicks / 120, startX: edgeX + dir * 10, endX: x });
        }
    }
};

/** Take-off and landing for going up from a to b: around b's edge if b is right above a. */
const ascentPoints = (a: NavNode, b: NavNode): [number, number][] => {
    const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0;
    if (!overlap) return b.x0 > a.x1 ? [[a.x1 - 12, b.x0 + 24]] : [[a.x0 + 12, b.x1 - 24]];
    return ([[b.x0 - 30, b.x0 + 24], [b.x1 + 30, b.x1 - 24]] as [number, number][]).filter(([t]) => t > a.x0 + 6 && t < a.x1 - 6);
};

const addJets = (nodes: NavNode[], platforms: Platform[], edges: NavEdge[]) => {
    for (const a of nodes) for (const b of nodes) {
        const dy = a.y - b.y;
        if (a === b || dy < 20 || dy > JET_RISE) continue;
        for (const [take, land] of ascentPoints(a, b)) {
            const hd = Math.abs(land - take);
            if (hd > JET_SIDE_MAX) continue;
            // Rise beside b, then cross over its top
            const clear = segmentClear(platforms, { x: take, y: a.y - BODY_H }, { x: take, y: b.y - BODY_H - 10 })
                && segmentClear(platforms, { x: take, y: b.y - BODY_H - 10 }, { x: land, y: b.y - BODY_H - 10 });
            if (!clear) continue;
            // Both sides of b are kept: the path search picks the one closer to where the bot is
            edges.push({ from: a.id, to: b.id, kind: 'jet', cost: 0.4 + dy / 300 + hd / 400, startX: take, endX: land });
        }
    }
};

/** Feet hang this far below the anchor once the rope is reeled in to its minimum. */
const HANG = HOOK_MIN_LENGTH + 4;
export const HOOK_JET_FINISH = 280; // at most this much climbing left for the jetpack after reeling in

/**
 * Hook as a lift (how players use it): fire at the underside of a platform beside b's edge —
 * b's own underside or anything above — reel in, let go and jetpack the rest of the way over
 * b's edge. Reaches well beyond the jetpack alone.
 */
const addHooks = (nodes: NavNode[], platforms: Platform[], edges: NavEdge[]) => {
    const state = { platforms } as unknown as GameState;
    const reaches = new Set(edges.filter(e => e.kind === 'jet').map(e => `${e.from}>${e.to}`));
    for (const a of nodes) for (const b of nodes) {
        const dy = a.y - b.y;
        if (a === b || dy < 160 || dy > HOOK_REACH + HOOK_JET_FINISH || reaches.has(`${a.id}>${b.id}`)) continue;
        for (const [take, land] of ascentPoints(a, b)) {
            let best: NavEdge | null = null; // the cheapest anchor for this side
            const from = { x: take, y: a.y - 2 };
            const leftSide = take < land;
            for (const c of platforms) {
                const under = c.y + c.h;
                const left = under + HANG - b.y; // climbing still needed after reeling in
                if (under >= a.y - BODY_H || left > HOOK_JET_FINISH) continue;
                // Grab just inside c's edge nearest to the take-off side, close to b's edge
                const edgeX = leftSide ? Math.min(b.x0, land) : Math.max(b.x1, land);
                if (c.x > edgeX + 40 || c.x + c.w < edgeX - 40) continue;
                const anchor = { x: Math.min(Math.max(edgeX + (leftSide ? 6 : -6), c.x + 4), c.x + c.w - 4), y: under };
                const d = Math.hypot(anchor.x - from.x, anchor.y - from.y);
                if (d > HOOK_REACH) continue;
                const hit = castRay(state, from, { x: (anchor.x - from.x) / d, y: (anchor.y - from.y) / d }, HOOK_RANGE);
                if (!hit || Math.hypot(hit.x - anchor.x, hit.y - anchor.y) > 14) continue;
                const cost = 0.8 + d / 240 + Math.max(0, left) / 300;
                if (!best || cost < best.cost) best = { from: a.id, to: b.id, kind: 'hook', cost, startX: take, endX: land, anchor };
            }
            if (best) edges.push(best);
        }
    }
};

const cache = new Map<string, NavGraph>();
// Every bot asks every tick: remember the answer per platforms array (rebuilt if its size changes)
const byArray = new WeakMap<Platform[], { size: number; graph: NavGraph }>();

export const buildNavGraph = (platforms: Platform[]): NavGraph => {
    const known = byArray.get(platforms);
    if (known && known.size === platforms.length) return known.graph;
    const key = platforms.map(p => `${p.x},${p.y},${p.w},${p.h}`).join('|');
    const hit = cache.get(key);
    if (hit) { byArray.set(platforms, { size: platforms.length, graph: hit }); return hit; }
    const nodes = buildSurfaces(platforms);
    const edges: NavEdge[] = [];
    addWalks(nodes, edges);
    addDrops(nodes, platforms, edges);
    addJets(nodes, platforms, edges);
    addHooks(nodes, platforms, edges);
    const out: NavEdge[][] = nodes.map(() => []);
    edges.forEach(e => out[e.from].push(e));
    const graph = { nodes, edges, out };
    cache.set(key, graph);
    byArray.set(platforms, { size: platforms.length, graph });
    return graph;
};
