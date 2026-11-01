import { describe, it, expect } from 'vitest';
import { Platform, GameMode, MapId } from '../../types';
import { buildNavGraph, JET_RISE, NavGraph } from './botNavGraph';
import { findPath, nodeAt } from './botPathfinder';
import { getPlatforms } from '../data/level';

let seq = 0;
const plat = (x: number, y: number, w: number, h: number): Platform => ({ id: `p${seq++}`, x, y, w, h, color: '#475569' });
const FLOOR = plat(-1000, 1000, 4000, 200);

const kindsOnPath = (g: NavGraph, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const start = nodeAt(g, from)!;
    return findPath(g, { from: start.id, goal: to }).map(e => e.kind);
};

describe('bot navigation graph', () => {
    it('walks along a floor and drops into a pit', () => {
        const g = buildNavGraph([plat(-1000, 1000, 1000, 200), plat(0, 1200, 400, 100), plat(400, 1000, 1000, 200)]);
        expect(kindsOnPath(g, { x: -500, y: 1000 }, { x: 200, y: 1200 })).toEqual(['drop']);
    });

    it('takes the jetpack up a step it can reach', () => {
        const g = buildNavGraph([FLOOR, plat(300, 1000 - JET_RISE + 20, 300, 30)]);
        expect(kindsOnPath(g, { x: 0, y: 1000 }, { x: 450, y: 1000 - JET_RISE + 20 })).toEqual(['jet']);
    });

    it('splits a floor where a wall stands on it, and goes over the wall', () => {
        const g = buildNavGraph([FLOOR, plat(500, 800, 40, 200)]);
        const left = nodeAt(g, { x: 0, y: 1000 })!, right = nodeAt(g, { x: 1000, y: 1000 })!;
        expect(left.id).not.toBe(right.id);
        const path = findPath(g, { from: left.id, goal: { x: 1000, y: 1000 } });
        expect(path.length).toBeGreaterThan(0);
        expect(path[path.length - 1].to).toBe(right.id);
    });

    it('uses the grapple hook as a lift for a ledge too high for the jetpack', () => {
        // Ledge 580 px up: beyond the jetpack's 490, reachable by hooking its underside and jetting over the edge
        const g = buildNavGraph([FLOOR, plat(400, 420, 300, 30)]);
        const path = findPath(g, { from: nodeAt(g, { x: 200, y: 1000 })!.id, fromX: 200, goal: { x: 550, y: 420 } });
        expect(path.map(e => e.kind)).toEqual(['hook']);
        expect(path[0].anchor!.y).toBe(450);                  // the ledge's underside…
        expect(path[0].anchor!.x).toBeLessThan(420);          // …right at its edge
    });

    it('goes to the closest reachable surface when the goal cannot be reached', () => {
        const g = buildNavGraph([FLOOR, plat(0, -2000, 200, 30)]);
        const start = nodeAt(g, { x: 0, y: 1000 })!;
        expect(findPath(g, { from: start.id, goal: { x: 100, y: -2000 } })).toEqual([]); // stays on the floor
    });

    it.each([
        ['station', GameMode.DEATHMATCH, MapId.DEFAULT],
        ['CTF', GameMode.CTF, MapId.DEFAULT],
        ['mine', GameMode.DEATHMATCH, MapId.TUNNELS],
        ['arena', GameMode.HUNGER_GAMES, MapId.HUNGER],
    ])('reaches most surfaces of the %s map from its floor', (_name, mode, map) => {
        const platforms = getPlatforms(mode as GameMode, map as MapId);
        const g = buildNavGraph(platforms);
        // The floor: the lowest of the wide surfaces (the ceiling's top is just as wide)
        const floor = g.nodes.filter(n => n.x1 - n.x0 >= 800).sort((a, b) => b.y - a.y)[0];
        // Tops of the outer walls and the ceiling (thick slabs other than the floor) are out of play
        const inPlay = g.nodes.filter(n => n.id === floor.id || !platforms.some(p => p.y === n.y && p.h >= 180 && n.x0 >= p.x && n.x1 <= p.x + p.w));
        const reachable = inPlay.filter(n => n.id === floor.id || findPath(g, { from: floor.id, goal: { x: (n.x0 + n.x1) / 2, y: n.y } }).at(-1)?.to === n.id);
        expect(reachable.length / inPlay.length).toBeGreaterThan(0.8);
    });
});
