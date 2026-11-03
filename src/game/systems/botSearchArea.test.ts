import { describe, it, expect, beforeEach } from 'vitest';
import { Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { clearBotMemory, getBotMemory } from './botMemory';
import { forgetStale, knownPos, SEARCH_AROUND_MS, SEARCH_RADIUS } from './botSearch';
import { chooseGoal } from './botGoals';
import { buildNavGraph } from './botNavGraph';
import { SMOKE_DURATION_MS, spawnSmoke } from './smoke';
import { distance } from '../utils/math';

const NOW = 1000;
const BODY_CENTER_Y = -27; // a fighter's centre: pos.y - height / 2

// Bot and enemy 300 px apart on a long floor, a ledge right above the enemy's spot and one far away
const setup = () => {
    const state = makeState();
    state.platforms = [
        { id: 'floor', x: -2000, y: 0, w: 6000, h: 100, color: '#000' },
        { id: 'ledgeNear', x: 250, y: -150, w: 200, h: 20, color: '#000' },
        { id: 'ledgeFar', x: 2500, y: -150, w: 200, h: 20, color: '#000' },
    ];
    const bot = makeBot('bot1', Team.RED, 0, 0) as any;
    const enemy = makeBot('enemy', Team.BLUE, 300, 0) as any;
    state.players = [bot, enemy];
    return { state, bot, enemy, mem: getBotMemory(bot), graph: buildNavGraph(state.platforms) };
};

/** The enemy is seen at x 300, then walks to x 600 into a fresh cloud at `at`. */
const seeThenHide = (s: ReturnType<typeof setup>, at: number) => {
    knownPos(s.state, s.bot, s.mem, s.enemy, NOW);
    s.enemy.pos = { x: 600, y: 0 };
    spawnSmoke(s.state, { x: 600, y: BODY_CENTER_Y }, at);
};

beforeEach(() => {
    clearBotMemory();
});

describe('last-seen spot lifetime', () => {
    it('is kept while younger than a smoke cloud lives', () => {
        const s = setup();
        seeThenHide(s, NOW + SMOKE_DURATION_MS - 100);
        expect(knownPos(s.state, s.bot, s.mem, s.enemy, NOW + SMOKE_DURATION_MS - 100)).toEqual({ x: 300, y: 0 });
    });

    it('is ignored and deleted once older than 10 s', () => {
        const s = setup();
        const later = NOW + SMOKE_DURATION_MS + 1;
        seeThenHide(s, later);
        expect(knownPos(s.state, s.bot, s.mem, s.enemy, later)).toBeNull();
        expect(s.mem.lastSeen.has('enemy')).toBe(false);
    });

    it('is deleted when the fighter dies', () => {
        const s = setup();
        seeThenHide(s, NOW);
        s.enemy.dead = true;
        forgetStale(s.state, s.mem, NOW + 10);
        expect(s.mem.lastSeen.has('enemy')).toBe(false);
    });

    it('does not carry over into the fighter\'s next life', () => {
        const s = setup();
        seeThenHide(s, NOW);
        s.enemy.respawnTimer = NOW + 3000; // died and came back while the bot was not looking
        expect(knownPos(s.state, s.bot, s.mem, s.enemy, NOW + 3500)).toBeNull();
        expect(s.mem.lastSeen.has('enemy')).toBe(false);
    });
});

describe('searching around the last-seen spot', () => {
    it('after reaching the spot, looks around within the search radius', () => {
        for (let run = 0; run < 10; run++) {
            clearBotMemory();
            const s = setup();
            seeThenHide(s, NOW);
            s.bot.pos = { x: 280, y: 0 }; // at the spot
            const goal = chooseGoal(s.state, s.bot, s.mem, s.enemy, s.graph, NOW);
            expect(s.mem.search).not.toBeNull();
            expect(distance(goal.moveTarget, { x: 300, y: 0 })).toBeLessThanOrEqual(SEARCH_RADIUS);
            expect(goal.target).toBe(s.enemy);
        }
    });

    it('goes back to roaming the map once the search time is over', () => {
        const s = setup();
        seeThenHide(s, NOW);
        s.bot.pos = { x: 280, y: 0 };
        chooseGoal(s.state, s.bot, s.mem, s.enemy, s.graph, NOW);
        chooseGoal(s.state, s.bot, s.mem, s.enemy, s.graph, NOW + SEARCH_AROUND_MS);
        expect(s.mem.search).toBeNull();
        expect(s.mem.state).toBe('roam');
    });

    it('never starts without smoke: a visible enemy is hunted', () => {
        const s = setup();
        s.bot.pos = { x: 280, y: 0 };
        const goal = chooseGoal(s.state, s.bot, s.mem, s.enemy, s.graph, NOW);
        expect(s.mem.search).toBeNull();
        expect(s.mem.state).toBe('hunt');
        expect(goal.target).toBe(s.enemy);
    });
});
