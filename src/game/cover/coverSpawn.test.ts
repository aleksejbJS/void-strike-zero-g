import { describe, it, expect } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { updatePhysics } from '../systems/physics';
import { Cover } from './coverTypes';
import { liftOutOfCover } from './coverSpawn';

const crate = (id: string, x: number, y: number, hp = 150): Cover => ({ id, kind: 'wood', pos: { x, y }, hp });

describe('liftOutOfCover', () => {
    it('puts a fighter overlapping a crate on top of it, x unchanged', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.cover = [crate('c', 500, 400)];
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 510, y: 400 };

        liftOutOfCover(state, p);

        expect(p.pos).toEqual({ x: 510, y: 354 });
    });

    it('leaves fighters alone that stand beside or on top of cover, or that meet a broken piece', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.cover = [crate('c', 500, 400), crate('gone', 900, 400, 0)];
        const beside = createMockPlayer('a', Team.NONE); beside.pos = { x: 550, y: 400 };
        const onTop = createMockPlayer('b', Team.NONE); onTop.pos = { x: 500, y: 354 };
        const broken = createMockPlayer('c', Team.NONE); broken.pos = { x: 900, y: 400 };

        for (const p of [beside, onTop, broken]) liftOutOfCover(state, p);

        expect(beside.pos).toEqual({ x: 550, y: 400 });
        expect(onTop.pos).toEqual({ x: 500, y: 354 });
        expect(broken.pos).toEqual({ x: 900, y: 400 });
    });

    it('climbs on until clear when pieces are stacked side by side at different heights', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.cover = [crate('low', 500, 400), crate('high', 530, 354)];
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 515, y: 400 };

        liftOutOfCover(state, p);

        expect(p.pos).toEqual({ x: 515, y: 308 });
    });

    it('does nothing in a state without cover', () => {
        const state = createMockState(GameMode.DUEL);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 5, y: 5 };
        liftOutOfCover(state, p);
        expect(p.pos).toEqual({ x: 5, y: 5 });
    });
});

describe('spawn safety net', () => {
    it('a fighter respawning inside a crate stands on top of it', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.cover = [crate('c', 500, 400)];
        const p = createMockPlayer('p1', Team.NONE);
        p.dead = true;
        p.respawnTimer = 0;
        state.players.push(p);

        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 505, y: 400 }), 'p1');

        expect(p.dead).toBe(false);
        expect(p.pos).toEqual({ x: 505, y: 354 });
    });
});
