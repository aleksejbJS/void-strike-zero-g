import { describe, it, expect } from 'vitest';
import { GameMode } from '../../types';
import { createMockState } from '../../test/mocks';
import { MAX_SMOKES, SMOKE_DURATION_MS, SMOKE_RADIUS } from '../../constants';
import { insideSmoke, smokeHides, smokeRadiusAt, spawnSmoke, updateSmokes } from './smoke';

const newState = () => createMockState(GameMode.DEATHMATCH);

describe('spawnSmoke', () => {
    it('creates the smokes list and a full-size cloud when none exists', () => {
        const state = newState();
        expect(state.smokes).toBeUndefined();
        const cloud = spawnSmoke(state, { x: 10, y: 20 }, 1000);
        expect(state.smokes).toEqual([cloud]);
        expect(cloud.pos).toEqual({ x: 10, y: 20 });
        expect(cloud.radius).toBe(SMOKE_RADIUS);
        expect(cloud.radius).toBe(110);
        expect(cloud.bornAt).toBe(1000);
        expect(cloud.endsAt - cloud.bornAt).toBe(SMOKE_DURATION_MS);
        expect(cloud.endsAt - cloud.bornAt).toBe(10000);
    });

    it('drops the oldest cloud when the cap is reached', () => {
        const state = newState();
        const first = spawnSmoke(state, { x: 0, y: 0 }, 0);
        for (let i = 1; i <= MAX_SMOKES; i++) spawnSmoke(state, { x: i, y: 0 }, i);
        expect(MAX_SMOKES).toBe(12);
        expect(state.smokes).toHaveLength(12);
        expect(state.smokes!.some(c => c.id === first.id)).toBe(false);
    });

    it('gives every cloud its own id', () => {
        const state = newState();
        const a = spawnSmoke(state, { x: 0, y: 0 }, 0);
        const b = spawnSmoke(state, { x: 0, y: 0 }, 0);
        expect(a.id).not.toBe(b.id);
    });
});

describe('smokeRadiusAt', () => {
    const cloud = spawnSmoke(newState(), { x: 0, y: 0 }, 5000);

    it('stays at full size until the fade starts', () => {
        expect(smokeRadiusAt(cloud, cloud.bornAt)).toBe(110);
        expect(smokeRadiusAt(cloud, cloud.bornAt + 7000)).toBe(110);
        expect(smokeRadiusAt(cloud, cloud.bornAt + 8000)).toBe(110);
    });

    it('shrinks linearly during the fade and is gone at the end', () => {
        expect(smokeRadiusAt(cloud, cloud.bornAt + 9000)).toBe(55);
        expect(smokeRadiusAt(cloud, cloud.endsAt)).toBe(0);
        expect(smokeRadiusAt(cloud, cloud.endsAt + 500)).toBe(0);
    });
});

describe('updateSmokes', () => {
    it('keeps a cloud until its last millisecond and removes it at endsAt', () => {
        const state = newState();
        const cloud = spawnSmoke(state, { x: 0, y: 0 }, 2000);
        updateSmokes(state, cloud.bornAt + 9999);
        expect(state.smokes).toHaveLength(1);
        updateSmokes(state, cloud.bornAt + 10000);
        expect(state.smokes).toHaveLength(0);
    });

    it('does nothing on a state that never had smoke', () => {
        const state = newState();
        updateSmokes(state, 1000);
        expect(state.smokes).toBeUndefined();
    });
});

describe('insideSmoke', () => {
    const state = newState();
    spawnSmoke(state, { x: 300, y: 300 }, 0);

    it('is true at the centre and inside the radius', () => {
        expect(insideSmoke(state, { x: 300, y: 300 }, 100)).toBe(true);
        expect(insideSmoke(state, { x: 400, y: 300 }, 100)).toBe(true);
    });

    it('is false outside the radius', () => {
        expect(insideSmoke(state, { x: 420, y: 300 }, 100)).toBe(false);
    });

    it('follows the shrinking cloud during the fade', () => {
        expect(insideSmoke(state, { x: 400, y: 300 }, 9000)).toBe(false); // radius is 55 there
        expect(insideSmoke(state, { x: 340, y: 300 }, 9000)).toBe(true);
    });

    it('is false on a state without smoke', () => {
        expect(insideSmoke(newState(), { x: 300, y: 300 }, 100)).toBe(false);
    });
});

describe('smokeHides', () => {
    const smoky = () => {
        const state = newState();
        spawnSmoke(state, { x: 300, y: 300 }, 0);
        return state;
    };

    it('hides a target that stands inside a cloud', () => {
        expect(smokeHides(smoky(), { x: 0, y: 300 }, { x: 310, y: 300 }, 100)).toBe(true);
    });

    it('hides a target when the line passes through a cloud between the two', () => {
        expect(smokeHides(smoky(), { x: 0, y: 300 }, { x: 600, y: 300 }, 100)).toBe(true);
    });

    it('does not hide when the line passes 150 px beside the cloud', () => {
        expect(smokeHides(smoky(), { x: 0, y: 450 }, { x: 600, y: 450 }, 100)).toBe(false);
    });

    it('does not hide a target that is short of the cloud', () => {
        expect(smokeHides(smoky(), { x: 0, y: 300 }, { x: 100, y: 300 }, 100)).toBe(false);
    });

    it('does not hide when the viewer is inside the cloud and the target is outside beyond it', () => {
        expect(smokeHides(smoky(), { x: 300, y: 300 }, { x: 600, y: 300 }, 100)).toBe(false);
    });

    it('hides nothing when there is no smoke', () => {
        expect(smokeHides(newState(), { x: 0, y: 0 }, { x: 600, y: 0 }, 100)).toBe(false);
    });

    it('stops hiding once the cloud has faded away', () => {
        const state = smoky();
        expect(smokeHides(state, { x: 0, y: 300 }, { x: 600, y: 300 }, 10000)).toBe(false);
    });
});
