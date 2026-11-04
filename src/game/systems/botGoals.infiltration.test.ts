import { describe, it, expect } from 'vitest';
import { GameMode, ItemType, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { getPlatforms, getInitialPickups } from '../data/level';
import { buildNavGraph } from './botNavGraph';
import { getBotMemory } from './botMemory';
import { chooseGoal } from './botGoals';

// Infiltration defenders holding the intel's spot are guarding, not escorting:
// that state must not be one of the "too busy to take cover" ones.
const setup = (distanceFromIntel: number) => {
    const state = createMockState(GameMode.INFILTRATION);
    state.platforms = getPlatforms(GameMode.INFILTRATION);
    state.pickups = getInitialPickups(GameMode.INFILTRATION);
    const intel = state.pickups.find(p => p.type === ItemType.INTEL)!;
    const bot = createMockPlayer('bot_guard', Team.RED);
    bot.type = 'bot';
    bot.pos = { x: intel.pos.x - distanceFromIntel, y: intel.pos.y };
    // Two guns and full ammo: no detour for a weapon pickup
    bot.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }, { ...WEAPONS_DATA[WeaponType.ROCKET_LAUNCHER] }];
    state.players = [bot];
    return { state, bot, mem: getBotMemory(bot), graph: buildNavGraph(state.platforms) };
};

describe('Infiltration defenders', () => {
    it('guard the intel when they are near it', () => {
        const { state, bot, mem, graph } = setup(100);
        const goal = chooseGoal(state, bot, mem, null, graph, 1000);
        expect(mem.state).toBe('guard');
        expect(goal.moveTarget).toBe(bot.pos);
    });

    it('also guard while walking back to it from afar', () => {
        const { state, bot, mem, graph } = setup(600);
        chooseGoal(state, bot, mem, null, graph, 1000);
        expect(mem.state).toBe('guard');
    });
});
