import { describe, it, expect } from 'vitest';
import { SnapshotBuffer, interpolateRemotePlayers, INTERP_DELAY_MS } from './interpolation';
import { createMockPlayer } from '../../test/mocks';
import { Team } from '../../types';

const snap = (x: number) => ({ players: [{ ...createMockPlayer('r', Team.NONE), pos: { x, y: 0 } }] }) as any;

describe('SnapshotBuffer', () => {
    it('blends between the two snapshots around the render time', () => {
        const buf = new SnapshotBuffer();
        buf.push(snap(0), 1000);
        buf.push(snap(100), 1100);
        expect(buf.sample('r', 1050)!.x).toBeCloseTo(50);
    });

    it('holds the newest position when render time is past the buffer', () => {
        const buf = new SnapshotBuffer();
        buf.push(snap(0), 1000);
        buf.push(snap(100), 1100);
        expect(buf.sample('r', 5000)!.x).toBe(100);
    });

    it('returns null for unknown players', () => {
        const buf = new SnapshotBuffer();
        buf.push(snap(0), 1000);
        expect(buf.sample('nobody', 1000)).toBeNull();
    });
});

describe('interpolateRemotePlayers', () => {
    it('moves remote players but never the local one', () => {
        const buf = new SnapshotBuffer();
        buf.push({ players: [{ ...createMockPlayer('r', Team.NONE), pos: { x: 0, y: 0 } }, { ...createMockPlayer('me', Team.NONE), pos: { x: 0, y: 0 } }] } as any, 1000);
        buf.push({ players: [{ ...createMockPlayer('r', Team.NONE), pos: { x: 100, y: 0 } }, { ...createMockPlayer('me', Team.NONE), pos: { x: 100, y: 0 } }] } as any, 1100);
        const players = [createMockPlayer('r', Team.NONE), createMockPlayer('me', Team.NONE)];
        players[1].pos = { x: 777, y: 0 };
        interpolateRemotePlayers(players, buf, 'me', 1050 + INTERP_DELAY_MS);
        expect(players[0].pos.x).toBeCloseTo(50);
        expect(players[1].pos.x).toBe(777);
    });
});
