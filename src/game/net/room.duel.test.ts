import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { GameRoom, RoomConfig } from './room';
import { MATCH_RESTART_DELAY } from '../systems/matchRound';
import { duelLoadout } from '../systems/duelRules';
import { PIT_SPAWNS } from '../data/pitMap';
import { DEFAULT_BUILD } from '../build/buildParts';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic', build: DEFAULT_BUILD };
const rooms: GameRoom[] = [];
const makeRoom = (config: Partial<RoomConfig> = {}) => {
    const room = new GameRoom({ mode: GameMode.DUEL, map: MapId.PIT, maxPlayers: 2, restartMatches: false, ...config });
    rooms.push(room);
    return room;
};
afterEach(() => {
    rooms.splice(0).forEach(r => r.dispose());
    vi.useRealTimers();
});

describe('GameRoom — duel', () => {
    it('has no bots unless asked for', () => {
        expect(makeRoom().state.players).toHaveLength(0);
        expect(makeRoom({ bots: 1 }).state.players.filter(p => p.type === 'bot')).toHaveLength(1);
    });

    it('gives a joined player the duel loadout', () => {
        const room = makeRoom();
        room.join('s1', join);
        expect(room.state.players[0].inventory).toEqual(duelLoadout());
        expect(room.state.players[0].weapon).toBe(room.state.players[0].inventory[0]);
    });

    it('puts the two fighters on opposite spawns', () => {
        const room = makeRoom();
        room.join('s1', join);
        room.join('s2', join);
        expect(room.state.players.map(p => p.pos)).toEqual([PIT_SPAWNS[0], PIT_SPAWNS[1]]);
    });

    it('keeps a bot opponent when the human joins', () => {
        const room = makeRoom({ maxPlayers: 1, bots: 1 });
        expect(room.join('s1', join)).toEqual({ ok: true });
        expect(room.state.players.map(p => p.type).sort()).toEqual(['bot', 'player']);
        const [bot, human] = [room.state.players.find(p => p.type === 'bot')!, room.state.players.find(p => p.type === 'player')!];
        expect(human.pos.x).not.toBe(bot.pos.x);
    });

    it('respawns a dead fighter with a fresh loadout', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        const room = makeRoom();
        room.join('s1', join);
        room.join('s2', join);
        const loser = room.state.players[1];
        loser.inventory.forEach(w => { w.ammo = 0; });
        loser.weapon = loser.inventory[3];
        loser.dead = true;
        loser.respawnTimer = Date.now() - 1;

        room.tick();

        expect(loser.dead).toBe(false);
        expect(loser.inventory).toEqual(duelLoadout());
        expect(loser.weapon).toBe(loser.inventory[0]);
        expect(Math.abs(loser.pos.x - PIT_SPAWNS[1].x)).toBeLessThan(5); // the survivor holds the left side
    });

    it('stays on the results when restartMatches is false', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        const room = makeRoom();
        room.join('s1', join);
        room.join('s2', join);
        room.state.players[0].score = 10;
        room.tick();
        expect(room.state.matchEndsAt).toBeDefined();

        vi.setSystemTime(1_000_000 + MATCH_RESTART_DELAY + 1);
        room.tick();

        expect(room.state.players[0].score).toBe(10);
        expect(room.state.matchWinner).toEqual({ playerId: 's1' });
        expect(room.state.matchEndsAt).toBeDefined();
    });

    it('restarts the match by default, with the fighters back on their own spawns', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        const room = makeRoom({ restartMatches: undefined });
        room.join('s1', join);
        room.join('s2', join);
        room.state.players[0].score = 10;
        room.tick();
        vi.setSystemTime(1_000_000 + MATCH_RESTART_DELAY + 1);
        room.tick();
        expect(room.state.players[0].score).toBe(0);
        expect(room.state.players[0].pos.x).not.toBe(room.state.players[1].pos.x);
    });
});

describe('GameRoom — restartMatches default (regression guard)', () => {
    it('a Deathmatch room still starts the next match', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 8 });
        rooms.push(room);
        room.state.players[0].score = 20;
        room.tick();
        expect(room.state.matchEndsAt).toBeDefined();
        vi.setSystemTime(1_000_000 + MATCH_RESTART_DELAY + 1);
        room.tick();
        expect(room.state.players[0].score).toBe(0);
        expect(room.state.matchEndsAt).toBeUndefined();
    });

    it('team modes keep their bots (the bots count default)', () => {
        const room = new GameRoom({ mode: GameMode.CTF, map: MapId.DEFAULT, maxPlayers: 8 });
        rooms.push(room);
        expect(room.state.players).toHaveLength(6);
    });
});
