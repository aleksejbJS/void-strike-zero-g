import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, ItemType, Pickup, Team } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { baseFlagPos, EXTRACTION_ZONE, HTF_FLAG_POS, INTEL_POS } from '../data/level';
import { gameEvents, GameEvent } from './events';
import { updatePhysics } from './physics';
import { applyDamage } from './combat';

type FlagEvent = Extract<GameEvent, { type: 'FLAG' }>;

let flags: FlagEvent[] = [];
let stop: () => void = () => {};
beforeEach(() => {
    flags = [];
    stop = gameEvents.on(e => { if (e.type === 'FLAG') flags.push(e); });
});
afterEach(() => stop());

const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');
const kill = (state: ReturnType<typeof createMockState>, id: string) =>
    applyDamage(state, state.players.find(p => p.id === id)!, 'killer', 9999, { x: 0, y: 0 });
const pickup = (over: Partial<Pickup>): Pickup => ({ id: 'item', type: ItemType.FLAG, team: Team.NONE, pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 0, ...over });
const playerAt = (id: string, team: Team, pos: { x: number; y: number }) => {
    const p = createMockPlayer(id, team);
    p.pos = { ...pos };
    return p;
};

describe('flag events: Capture the Flag', () => {
    it('grabbing the enemy flag announces that flag', () => {
        const state = createMockState(GameMode.CTF);
        state.pickups.push(pickup({ id: 'flag_red', team: Team.RED, pos: baseFlagPos(Team.RED) }));
        state.players.push(playerAt('blue', Team.BLUE, baseFlagPos(Team.RED)));
        tick(state);
        expect(flags).toEqual([{ type: 'FLAG', kind: 'ctf', action: 'grabbed', team: Team.RED }]);
    });

    it('bringing it home announces the scoring team', () => {
        const state = createMockState(GameMode.CTF);
        state.pickups.push(pickup({ id: 'flag_blue', team: Team.BLUE, pos: baseFlagPos(Team.BLUE) }));
        state.pickups.push(pickup({ id: 'flag_red', team: Team.RED, pos: baseFlagPos(Team.RED), active: false }));
        const carrier = playerAt('blue', Team.BLUE, baseFlagPos(Team.BLUE));
        carrier.hasFlag = Team.RED;
        state.players.push(carrier);
        tick(state);
        expect(flags).toEqual([{ type: 'FLAG', kind: 'ctf', action: 'captured', team: Team.BLUE }]);
        expect(state.scores[Team.BLUE]).toBe(1);
    });

    it('a carrier dying loses the flag they carried', () => {
        const state = createMockState(GameMode.CTF);
        state.pickups.push(pickup({ id: 'flag_red', team: Team.RED, pos: baseFlagPos(Team.RED), active: false }));
        const carrier = playerAt('blue', Team.BLUE, { x: 500, y: 0 });
        carrier.hasFlag = Team.RED;
        state.players.push(carrier);
        kill(state, 'blue');
        expect(flags).toEqual([{ type: 'FLAG', kind: 'ctf', action: 'lost', team: Team.RED }]);
    });

    it('a fighter without a flag dying announces nothing', () => {
        const state = createMockState(GameMode.CTF);
        state.players.push(playerAt('blue', Team.BLUE, { x: 500, y: 0 }));
        kill(state, 'blue');
        expect(flags).toEqual([]);
    });
});

describe('flag events: Hold the Flag', () => {
    it('picking up the neutral flag announces the holder team, dying loses it', () => {
        const state = createMockState(GameMode.HOLD_THE_FLAG);
        state.pickups.push(pickup({ id: 'htf', team: Team.NONE, pos: HTF_FLAG_POS }));
        state.players.push(playerAt('red', Team.RED, HTF_FLAG_POS));
        tick(state);
        kill(state, 'red');
        expect(flags).toEqual([
            { type: 'FLAG', kind: 'hold', action: 'grabbed', team: Team.RED },
            { type: 'FLAG', kind: 'hold', action: 'lost', team: Team.RED },
        ]);
    });
});

describe('flag events: Infiltration', () => {
    it('intel grabbed, extracted', () => {
        const state = createMockState(GameMode.INFILTRATION);
        state.pickups.push(pickup({ id: 'intel', type: ItemType.INTEL, team: Team.RED, pos: INTEL_POS, respawnTime: -1, value: 1000 }));
        const thief = playerAt('blue', Team.BLUE, INTEL_POS);
        state.players.push(thief);
        tick(state);
        thief.pos = { x: EXTRACTION_ZONE.x + EXTRACTION_ZONE.w / 2, y: EXTRACTION_ZONE.y + EXTRACTION_ZONE.h / 2 };
        tick(state);
        expect(flags.map(f => [f.kind, f.action])).toEqual([['intel', 'grabbed'], ['intel', 'captured']]);
    });

    it('a carrier dying drops the intel', () => {
        const state = createMockState(GameMode.INFILTRATION);
        const thief = playerAt('blue', Team.BLUE, { x: 500, y: 0 });
        thief.hasFlag = Team.RED;
        state.players.push(thief);
        kill(state, 'blue');
        expect(flags).toEqual([{ type: 'FLAG', kind: 'intel', action: 'lost', team: Team.NONE }]);
    });
});
