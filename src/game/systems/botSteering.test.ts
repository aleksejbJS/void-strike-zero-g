import { describe, it, expect } from 'vitest';
import { Entity, Team } from '../../types';
import { makeState, makeBot } from '../../test/botFixtures';
import { buildNavGraph } from './botNavGraph';
import { newBotNav } from './botNavState';
import { steer } from './botSteering';

// The Default map's left ledge: its medkit hangs right over the left edge (x -400)
const ledge = { id: 'ledge', x: -400, y: 650, w: 350, h: 35, color: '#000' };

describe('steer on the goal surface', () => {
    const arriveFrom = (botX: number) => {
        const state = makeState();
        state.platforms = [ledge];
        const bot = makeBot('bot', Team.NONE, botX, 650) as unknown as Entity;
        state.players = [bot];
        return steer(state, bot, newBotNav(), buildNavGraph(state.platforms), { x: -400, y: 610 }, 1000);
    };

    it('walks on to a pickup at the very edge until it is within reach', () => {
        // 35 px from the edge: a 30 px wide fighter does not touch the 40 px medkit yet
        expect(arriveFrom(-365).inputX).toBe(-1);
    });

    it('stops once the pickup is within reach', () => {
        expect(arriveFrom(-372).inputX).toBe(0);
    });
});
