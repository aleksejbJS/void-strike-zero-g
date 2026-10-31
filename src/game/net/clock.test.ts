import { describe, it, expect } from 'vitest';
import { toLocalClock } from './clientSession';
import { createMockPlayer } from '../../test/mocks';
import { Team } from '../../types';

describe('toLocalClock', () => {
    it('shifts server timestamps by the clock offset, but not "never" or unset ones', () => {
        const alive = { ...createMockPlayer('a', Team.NONE), respawnTimer: 5000 };
        const hungerSpectator = { ...createMockPlayer('b', Team.NONE), respawnTimer: Number.MAX_SAFE_INTEGER };
        const snap: any = {
            serverTime: 1000, hungerRoundEndsAt: 11000, infiltrationEndTime: undefined, lastHTFScore: 0,
            hungerZone: { x: 0, y: 0, w: 1, h: 1, nextShrinkAt: 6000, lastShrink: 900 },
            players: [alive, hungerSpectator],
        };
        toLocalClock(snap, 300);
        expect(snap.hungerRoundEndsAt).toBe(11300);
        expect(snap.infiltrationEndTime).toBeUndefined();
        expect(snap.lastHTFScore).toBe(0);
        expect(snap.hungerZone.nextShrinkAt).toBe(6300);
        expect(alive.respawnTimer).toBe(5300);
        expect(hungerSpectator.respawnTimer).toBe(Number.MAX_SAFE_INTEGER);
    });
});
