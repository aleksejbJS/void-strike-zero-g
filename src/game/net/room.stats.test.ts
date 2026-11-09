import { describe, it, expect, afterEach } from 'vitest';
import { GameMode, MapId, Team, WeaponType } from '../../types';
import { GameRoom } from './room';
import { applyDamage } from '../systems/combat';
import { DEFAULT_BUILD } from '../build/buildParts';
import { WEAPONS_DATA } from '../../constants';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic', build: DEFAULT_BUILD };
const rooms: GameRoom[] = [];
const makeRoom = (mode: GameMode) => {
    const room = new GameRoom({ mode, map: MapId.DEFAULT, maxPlayers: 8 });
    rooms.push(room);
    return room;
};
afterEach(() => rooms.splice(0).forEach(r => r.dispose()));

describe('GameRoom — per-player stats', () => {
    it('every room has its own stats session', () => {
        const a = makeRoom(GameMode.DEATHMATCH).snapshot(1).statsSession;
        const b = makeRoom(GameMode.DEATHMATCH).snapshot(1).statsSession;
        expect(typeof a).toBe('string');
        expect(a!.length).toBeGreaterThan(0);
        expect(a).not.toBe(b);
    });

    it('a kill shows up in the snapshot, and the session and counters survive the next match', () => {
        const room = makeRoom(GameMode.CTF);
        room.join('s1', join);
        const session = room.snapshot(1).statsSession;
        room.state.players.find(p => p.id === 's1')!.weapon = { ...WEAPONS_DATA[WeaponType.RAILGUN] }; // a kill counts the killer's weapon
        const bot = room.state.players.find(p => p.type === 'bot' && p.team === Team.RED)!;
        applyDamage(room.state, bot, 's1', 9999, { x: 1, y: 0 }, 0, { weapon: WeaponType.RAILGUN });
        expect(room.snapshot(2).playerStats?.s1).toEqual({ botKills: 1, railgunKills: 1 });

        room.state.scores[Team.BLUE] = 3;
        room.tick(); // match over
        room.state.matchEndsAt = Date.now() - 1; // skip the results screen
        room.tick(); // the next match starts (resetMatch)
        expect(room.state.matchWinner).toBeUndefined();
        expect(room.snapshot(3).statsSession).toBe(session);
        expect(room.snapshot(3).playerStats?.s1).toMatchObject({ botKills: 1, railgunKills: 1 });
    });

    it('a player who leaves takes their counters out of the snapshot; the others keep theirs', () => {
        const room = makeRoom(GameMode.DEATHMATCH);
        room.join('s1', join);
        room.join('s2', join);
        room.state.playerStats = { s1: { kills: 2 }, s2: { botKills: 1 } };
        expect(room.snapshot(1).playerStats).toHaveProperty('s1');

        room.leave('s1');
        const stats = room.snapshot(2).playerStats;
        expect(stats).not.toHaveProperty('s1');
        expect(stats?.s2).toEqual({ botKills: 1 });
    });
});
