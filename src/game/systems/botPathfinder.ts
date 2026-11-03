// Path search on the bots' navigation graph: cheapest route (Dijkstra — maps have a few
// dozen surfaces) to the surface under a goal, or to the closest reachable surface.

import { Vector2 } from '../../types';
import { NavEdge, NavGraph, NavNode, surfaceBelow } from './botNavGraph';

export const edgeKey = (e: NavEdge) => `${e.from}>${e.to}:${e.kind}@${Math.round(e.startX)}`;

const STAND_TOLERANCE = 8;

/** The surface a fighter stands on, or the one it will land on. */
export const nodeAt = (graph: NavGraph, pos: Vector2): NavNode | null => {
    // Right on a surface first; then one the body still overlaps (standing on its very edge)
    const level = graph.nodes.filter(n => Math.abs(pos.y - n.y) <= STAND_TOLERANCE);
    const standing = level.find(n => pos.x >= n.x0 && pos.x <= n.x1) ?? level.find(n => pos.x >= n.x0 - 16 && pos.x <= n.x1 + 16);
    return standing ?? surfaceBelow(graph.nodes, pos.x, pos.y);
};

/** The surface a goal sits on (pickups float a little above theirs). */
export const goalNode = (graph: NavGraph, goal: Vector2): NavNode | null =>
    surfaceBelow(graph.nodes, goal.x, goal.y - 4) ?? surfaceBelow(graph.nodes, goal.x, goal.y - 200);

const centre = (n: NavNode) => ({ x: (n.x0 + n.x1) / 2, y: n.y });

export interface PathQuery {
    from: number;
    goal: Vector2;
    allowed?: (n: NavNode) => boolean;   // e.g. inside the Hunger Games zone
    blocked?: { has(key: string): boolean }; // edges that failed recently
    fromX?: number;                      // where on the start surface the bot stands
    walkPxPerS?: number;                 // ground speed; slower than a run (e.g. wounded) makes walks cost more
}

const RUN_PX_S = 240; // running along a surface to the next move costs time too

/** Edges from `from` towards the goal; empty when already there or nothing is reachable. */
export const findPath = (graph: NavGraph, q: PathQuery): NavEdge[] => {
    const n = graph.nodes.length;
    const walkSpeed = q.walkPxPerS ?? RUN_PX_S;
    const dist = new Array<number>(n).fill(Infinity);
    const via = new Array<NavEdge | null>(n).fill(null);
    const done = new Array<boolean>(n).fill(false);
    const arriveX = new Array<number>(n).fill(0); // where the best route reaches each surface
    dist[q.from] = 0;
    arriveX[q.from] = q.fromX ?? centre(graph.nodes[q.from]).x;
    for (;;) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0) break;
        done[u] = true;
        for (const e of graph.out[u]) {
            if (q.blocked?.has(edgeKey(e)) || (q.allowed && !q.allowed(graph.nodes[e.to]))) continue;
            const d = dist[u] + Math.abs(e.startX - arriveX[u]) / walkSpeed + e.cost;
            if (d < dist[e.to]) { dist[e.to] = d; via[e.to] = e; arriveX[e.to] = e.endX; }
        }
    }
    // Aim for the goal's surface; if it can't be reached, the reachable surface closest to the goal
    const target = goalNode(graph, q.goal);
    let end = target && dist[target.id] < Infinity ? target.id : -1;
    if (end < 0) {
        let best = Infinity;
        graph.nodes.forEach((node, i) => {
            if (dist[i] === Infinity) return;
            const c = centre(node), d = Math.hypot(c.x - q.goal.x, c.y - q.goal.y);
            if (d < best) { best = d; end = i; }
        });
    }
    const path: NavEdge[] = [];
    for (let at = end; at >= 0 && at !== q.from && via[at]; at = via[at]!.from) path.unshift(via[at]!);
    return path;
};
