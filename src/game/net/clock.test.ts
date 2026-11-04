import { describe, it, expect } from 'vitest';
import { toLocalClock } from './clock';
import { createMockPlayer } from '../../test/mocks';
import { Team } from '../../types';

describe('toLocalClock', () => {
    it('shifts server timestamps by the clock offset, but not "never" or unset ones', () => {
        const alive = { ...createMockPlayer('a', Team.NONE), respawnTimer: 5000 };
        const hungerSpectator = { ...createMockPlayer('b', Team.NONE), respawnTimer: Number.MAX_SAFE_INTEGER };
        const snap: any = {
            serverTime: 1000, hungerRoundEndsAt: 11000, hungerRoundStartedAt: 500, infiltrationEndTime: undefined, lastHTFScore: 0,
            hungerZone: { x: 0, y: 0, w: 1, h: 1, nextShrinkAt: 6000, lastShrink: 900 },
            players: [alive, hungerSpectator],
        };
        toLocalClock(snap, 300);
        expect(snap.hungerRoundEndsAt).toBe(11300);
        expect(snap.hungerRoundStartedAt).toBe(800);
        expect(snap.infiltrationEndTime).toBeUndefined();
        expect(snap.lastHTFScore).toBe(0);
        expect(snap.hungerZone.nextShrinkAt).toBe(6300);
        expect(alive.respawnTimer).toBe(5300);
        expect(hungerSpectator.respawnTimer).toBe(Number.MAX_SAFE_INTEGER);
    });
});

describe('toLocalClock smoke clouds', () => {
    it('shifts each cloud\'s birth and end, leaving the host\'s own objects alone', () => {
        const cloud = { id: 'smoke_1', pos: { x: 1, y: 2 }, radius: 110, bornAt: 2000, endsAt: 12000 };
        const snap: any = { serverTime: 5000, players: [], smokes: [cloud] };
        toLocalClock(snap, -400);
        expect(snap.smokes).toEqual([{ ...cloud, bornAt: 1600, endsAt: 11600 }]);
        expect(cloud.endsAt).toBe(12000);
    });

    it('copes with a snapshot that has no clouds', () => {
        const snap: any = { serverTime: 5000, players: [] };
        toLocalClock(snap, 300);
        expect(snap.smokes).toBeUndefined();
    });
});

describe('toLocalClock cover status', () => {
    it('clock shifts returnsAt, leaving pieces that are not coming back and the host\'s own list alone', () => {
        const status = [{ id: 'gone', hp: 0, returnsAt: 36000 }, { id: 'whole', hp: 150 }];
        const snap: any = { serverTime: 5000, players: [], coverStatus: status };
        toLocalClock(snap, 300);
        expect(snap.coverStatus).toStrictEqual([{ id: 'gone', hp: 0, returnsAt: 36300 }, { id: 'whole', hp: 150 }]);
        expect(status[0].returnsAt).toBe(36000);
    });

    it('copes with a snapshot from a host that sends no cover status', () => {
        const snap: any = { serverTime: 5000, players: [] };
        toLocalClock(snap, 300);
        expect(snap.coverStatus).toBeUndefined();
    });
});
