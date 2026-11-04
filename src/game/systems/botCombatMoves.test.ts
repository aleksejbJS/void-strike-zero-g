import { describe, it, expect } from 'vitest';
import { Entity, Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { buildNavGraph, JET_RISE } from './botNavGraph';
import { IDLE, newBotMoves, newBotNav } from './botNavState';
import { combatMoves } from './botCombatMoves';
import { piece } from '../cover/coverTestKit';

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

describe('combatMoves cover', () => {
    // Enemy 200 px to the right (inside the machine gun's 320 px range), a crate halfway: its far-side spot is x 57
    const withCrate = (visible = true) => {
        const s = setup(100);
        const state = makeState();
        state.platforms = platforms;
        state.cover = [piece('crate', 'wood', 100, 1000)];
        const enemy = makeBot('enemy', Team.NONE, 200, 1000) as unknown as Entity;
        state.players = [s.bot, enemy];
        const graph = buildNavGraph(platforms);
        const step = (now: number) => combatMoves(state, s.bot, s.nav, s.moves, graph, enemy, visible, { ...IDLE }, now);
        return { ...s, state, step };
    };

    it('walks to the crate and crouches behind it', () => {
        const { bot, step } = withCrate();
        expect(step(1000)).toMatchObject({ inputX: 1, wantsDown: false });
        bot.pos.x = 57;
        expect(step(1008)).toMatchObject({ inputX: 0, wantsDown: true, isFlying: false });
    });

    it('crouches instead of hopping when hit behind cover', () => {
        const { bot, step } = withCrate();
        bot.pos.x = 57;
        step(1000);
        bot.health -= 10;
        expect(step(1008)).toMatchObject({ wantsDown: true, isFlying: false });
    });

    it('takes cover from an unseen shooter for 1.5 s after a hit', () => {
        const { bot, step } = withCrate(false);
        step(1000);
        expect(step(1008).wantsDown).toBeFalsy(); // not hit, enemy not in sight: no cover
        bot.health -= 10;
        expect(step(1016).inputX).toBe(1);
        expect(step(1016 + 1500).inputX).toBe(0);
    });
});
