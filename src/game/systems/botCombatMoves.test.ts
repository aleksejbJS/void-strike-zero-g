import { describe, it, expect } from 'vitest';
import { Entity, Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { buildNavGraph, JET_RISE } from './botNavGraph';
import { IDLE, newBotMoves, newBotNav } from './botNavState';
import { combatMoves } from './botCombatMoves';

// A floor with a ledge to the left that a jetpack reaches: the way out when the enemy stands to the right
const platforms = [
    { id: 'floor', x: -1000, y: 1000, w: 4000, h: 200, color: '#000' },
    { id: 'ledge', x: -500, y: 1000 - JET_RISE + 20, w: 300, h: 30, color: '#000' },
];

const setup = (health: number, wounded = false) => {
    const state = makeState();
    state.platforms = platforms;
    const bot = { ...makeBot('bot', Team.NONE, 0, 1000), health, ...(wounded ? { wound: { by: 'shooter' } } : {}) } as unknown as Entity;
    const enemy = makeBot('enemy', Team.NONE, 200, 1000) as unknown as Entity;
    state.players = [bot, enemy];
    const graph = buildNavGraph(platforms);
    const nav = newBotNav();
    const moves = newBotMoves(bot.health);
    const step = (now: number) => combatMoves(state, bot, nav, moves, graph, enemy, true, { ...IDLE }, now);
    return { bot, nav, moves, step };
};

describe('combatMoves dodge hop', () => {
    it('hops after a real hit', () => {
        const { bot, step } = setup(100);
        step(1000);
        bot.health -= 10;
        expect(step(1008).isFlying).toBe(true);
    });

    it('does not hop for bleeding, however long it lasts', () => {
        const { bot, step } = setup(10, true);
        // 10 s of bleeding at 120 ticks per second, a step every 8 ms
        for (let i = 0; i < 1200; i++) {
            bot.health -= 1 / 120;
            expect(step(1000 + i * 8).isFlying).toBe(false);
        }
    });

    it('still hops for a real hit on a bleeding bot', () => {
        const { bot, step } = setup(10, true);
        step(1000);
        bot.health -= 1 / 120;
        expect(step(1008).isFlying).toBe(false);
        bot.health -= 5;
        expect(step(1016).isFlying).toBe(true);
    });
});

describe('combatMoves escape', () => {
    it('a nearly dead bot leaves the surface when the enemy is close', () => {
        const { nav, step } = setup(20);
        step(1000);
        expect(nav.path).toHaveLength(1);
    });

    it('a wounded bot keeps heading for its medkit instead', () => {
        const { nav, moves, step } = setup(8, true);
        step(1000);
        expect(nav.path).toHaveLength(0);
        expect(moves.escapeReadyAt).toBe(0);
    });
});
