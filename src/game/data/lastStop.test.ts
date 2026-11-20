import { describe, expect, it } from 'vitest';
import { GameMode, ItemType, MapId, Team, WeaponType } from '../../types';
import { createRoomState } from '../net/roomSetup';
import { GameRoom } from '../net/room';
import { coverRect } from '../cover/coverGeometry';
import { LAST_STOP_SPAWNS } from './lastStop/spawns';
import { mapPoint } from './lastStop/layout';
import { validateJoin } from '../net/validation';
import { offlineBotCount } from './offlineBots';
import { buildNavGraph, solidAt, surfaceBelow } from '../systems/botNavGraph';
import { reachableFrom } from '../systems/botPathfinder';

const map = MapId.LAST_STOP;
const setup = () => createRoomState(GameMode.DEATHMATCH, map);

describe('Last Stop Deathmatch', () => {
    it('supplies each alternate weapon on a clear surface', () => {
        const state = setup();
        const graph = buildNavGraph(state.platforms);
        const weapons = state.pickups.filter(p => p.type === ItemType.WEAPON);
        expect(new Set(weapons.map(p => p.subtype))).toEqual(
            new Set(Object.values(WeaponType).filter(type => type !== WeaponType.MACHINE_GUN)),
        );
        const props = (state.cover ?? []).map(coverRect);
        for (const pickup of state.pickups) {
            expect(solidAt([...state.platforms, ...props], pickup.pos.x, pickup.pos.y), pickup.id).toBe(false);
            const surface = surfaceBelow(graph.nodes, pickup.pos.x, pickup.pos.y);
            expect(surface && surface.y - pickup.pos.y, pickup.id).toBeLessThan(90);
        }
    });

    it('connects the four fight areas in the bot navigation graph', () => {
        const state = setup();
        const graph = buildNavGraph(state.platforms);
        const points = [
            { x: 985, y: 1090 }, { x: 2060, y: 1140 }, { x: 4120, y: 1112 },
            { x: 1900, y: 1720 }, { x: 3550, y: 1690 },
        ];
        const surfaces = points.map(p => surfaceBelow(graph.nodes, p.x, p.y));
        for (const from of surfaces) {
            expect(from).not.toBeNull();
            for (const to of surfaces) {
                expect(reachableFrom(graph, from!.id).has(to!.id), `${from!.id} to ${to!.id}`).toBe(true);
            }
        }
    });

    it('lets fighters use the visible pumps as permanent cover', () => {
        const state = setup();
        for (const x of [336, 394]) {
            const pos = mapPoint(x, 450);
            expect(solidAt(state.platforms, pos.x, pos.y)).toBe(true);
        }
    });

    it('leaves a standing fighter clear of solids and props at each spawn', () => {
        const state = setup();
        const props = (state.cover ?? []).map(coverRect);
        const solids = [...state.platforms, ...props];
        for (const pos of LAST_STOP_SPAWNS) {
            expect(solids.some(p => pos.x - 15 < p.x + p.w && pos.x + 15 > p.x
                && pos.y - 72 < p.y + p.h && pos.y > p.y), JSON.stringify(pos)).toBe(false);
            expect(state.platforms.some(p => pos.x >= p.x && pos.x <= p.x + p.w && pos.y === p.y)).toBe(true);
        }
    });

    it('leaves clear drops down three shafts and both branches at the central junction', () => {
        const state = setup();
        for (const x of [164, 895, 1604]) {
            for (let y = 515; y < 745; y += 4) {
                const pos = mapPoint(x, y);
                expect(solidAt(state.platforms, pos.x, pos.y), `${x},${y}`).toBe(false);
            }
        }
        for (let x = 730; x < 1050; x += 4) {
            const pos = mapPoint(x, 744);
            expect(solidAt(state.platforms, pos.x, pos.y), `${x},744`).toBe(false);
        }
    });

    it('starts an offline match with room for seven bots', () => {
        expect(offlineBotCount(GameMode.DEATHMATCH, map)).toBe(7);
        expect(offlineBotCount(GameMode.DEATHMATCH)).toBe(3);
    });

    it('fills eight distinct FFA positions in the authoritative room', () => {
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map, maxPlayers: 8 });
        try {
            expect(room.state.players).toHaveLength(8);
            expect(room.state.players.every(p => p.team === Team.NONE)).toBe(true);
            expect(new Set(room.state.players.map(p => `${p.pos.x},${p.pos.y}`)).size).toBe(8);
            for (let i = 0; i < 8; i++) {
                const request = validateJoin({ name: `Player ${i + 1}` })!;
                expect(room.join(`player-${i}`, request)).toEqual({ ok: true });
            }
            expect(room.state.players.every(p => p.type === 'player')).toBe(true);
            expect(room.join('ninth', validateJoin({ name: 'Ninth' })!)).toEqual({ ok: false, reason: 'full' });
            room.tick();
            expect(room.snapshot(Date.now()).players).toHaveLength(8);
        } finally {
            room.dispose();
        }
    });
});
