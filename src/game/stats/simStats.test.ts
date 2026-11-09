// Captures and pickups counted by the simulation itself (updatePhysics), humans only.
import { describe, it, expect } from 'vitest';
import { Entity, GameMode, GameState, ItemType, Pickup, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { baseFlagPos } from '../data/level';
import { updatePhysics } from '../systems/physics';

const tick = (state: GameState) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');
const flag = (team: Team, active = true): Pickup =>
    ({ id: `flag_${team}`, type: ItemType.FLAG, team, pos: baseFlagPos(team), active, respawnTime: 0, value: 0 });

const capture = (type: Entity['type']) => {
    const state = createMockState(GameMode.CTF);
    state.pickups.push(flag(Team.BLUE), flag(Team.RED, false));
    const carrier = { ...createMockPlayer('blue', Team.BLUE), type, pos: baseFlagPos(Team.BLUE), hasFlag: Team.RED };
    state.players.push(carrier);
    tick(state);
    expect(state.scores[Team.BLUE]).toBe(1); // the capture happened
    return state;
};

const pickUpHealth = (type: Entity['type']) => {
    const state = createMockState(GameMode.DEATHMATCH);
    state.pickups.push({ id: 'h1', type: ItemType.HEALTH, pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 25 });
    state.players.push({ ...createMockPlayer('p1', Team.NONE), type, health: 50 });
    tick(state);
    expect(state.pickups[0].active).toBe(false); // the pickup happened
    return state;
};

describe('simulation stats', () => {
    it('a human bringing the flag home counts a capture', () => {
        expect(capture('player').playerStats?.blue).toMatchObject({ flagCaptures: 1 });
    });

    it('a bot capture is credited to nobody', () => {
        expect(capture('bot').playerStats?.blue).toBeUndefined();
    });

    it('a human picking up an item counts a pickup', () => {
        expect(pickUpHealth('player').playerStats?.p1).toEqual({ itemPickups: 1 });
    });

    it('a bot pickup is credited to nobody', () => {
        expect(pickUpHealth('bot').playerStats?.p1).toBeUndefined();
    });
});
