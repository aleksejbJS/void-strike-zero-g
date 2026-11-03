import { describe, it, expect, beforeEach } from 'vitest';
import { GameMode, Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { clearBotMemory, getBotMemory } from './botMemory';
import { chasePoint, SEARCH_REACHED } from './botSearch';
import { chooseGoal } from './botGoals';
import { buildNavGraph } from './botNavGraph';
import { spawnSmoke } from './smoke';

const NOW = 1000;
const BODY_CENTER_Y = -27; // a fighter's centre: pos.y - height / 2

// Open floor, bot and enemy 300 px apart (pos = centre-x, bottom-y)
const setup = () => {
    const state = makeState();
    const bot = makeBot('bot1', Team.RED, 0, 0) as any;
    const enemy = makeBot('enemy', Team.BLUE, 300, 0) as any;
    state.players = [bot, enemy];
    return { state, bot, enemy, mem: getBotMemory(bot) };
};

beforeEach(() => {
    clearBotMemory();
});

describe('chasePoint', () => {
    it('returns the real position and records it when there is no smoke', () => {
        const { state, bot, enemy, mem } = setup();
        expect(chasePoint(state, bot, mem, enemy, NOW)).toBe(enemy.pos);
        expect(mem.lastSeen.get('enemy')).toEqual({ x: 300, y: 0 });
    });

    it('still tracks an enemy behind a wall (walls do not hide a position)', () => {
        const { state, bot, enemy, mem } = setup();
        state.platforms = [{ id: 'wall', x: 140, y: -200, w: 20, h: 300, color: '#000' }];
        expect(chasePoint(state, bot, mem, enemy, NOW)).toBe(enemy.pos);
    });

    it('goes to the last-seen spot, not the real one, once the enemy hides in smoke', () => {
        const { state, bot, enemy, mem } = setup();
        chasePoint(state, bot, mem, enemy, NOW);
        enemy.pos = { x: 600, y: 0 };
        spawnSmoke(state, { x: 600, y: BODY_CENTER_Y }, NOW);
        expect(chasePoint(state, bot, mem, enemy, NOW)).toEqual({ x: 300, y: 0 });
    });

    it('forgets the spot once the bot has reached it', () => {
        const { state, bot, enemy, mem } = setup();
        chasePoint(state, bot, mem, enemy, NOW);
        enemy.pos = { x: 600, y: 0 };
        spawnSmoke(state, { x: 600, y: BODY_CENTER_Y }, NOW);
        bot.pos = { x: 300 - SEARCH_REACHED, y: 0 };
        expect(chasePoint(state, bot, mem, enemy, NOW)).toBeNull();
        expect(mem.lastSeen.has('enemy')).toBe(false);
    });

    it('knows nothing about an enemy never seen before it hid', () => {
        const { state, bot, enemy, mem } = setup();
        spawnSmoke(state, { x: 300, y: BODY_CENTER_Y }, NOW);
        expect(chasePoint(state, bot, mem, enemy, NOW)).toBeNull();
    });
});

describe('goals with a fighter hidden in smoke', () => {
    it('CTF: chases the enemy carrier to where it was last seen', () => {
        const { state, bot, enemy, mem } = setup();
        state.mode = GameMode.CTF;
        enemy.hasFlag = Team.RED; // carries the bot's flag
        const graph = buildNavGraph(state.platforms);
        chooseGoal(state, bot, mem, enemy, graph, NOW);
        enemy.pos = { x: 800, y: 0 };
        spawnSmoke(state, { x: 800, y: BODY_CENTER_Y }, NOW);

        const goal = chooseGoal(state, bot, mem, enemy, graph, NOW);
        expect(goal.moveTarget).toEqual({ x: 300, y: 0 });
        expect(goal.target).toBe(enemy);
    });

    it('Deathmatch: roams when the target is hidden and was never seen, still aiming at it', () => {
        const { state, bot, enemy, mem } = setup();
        spawnSmoke(state, { x: 300, y: BODY_CENTER_Y }, NOW);
        const goal = chooseGoal(state, bot, mem, enemy, buildNavGraph(state.platforms), NOW);
        expect(mem.state).toBe('roam');
        expect(goal.target).toBe(enemy);
    });
});
