import { describe, it, expect, afterEach } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { GameRoom } from './room';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' };
const rooms: GameRoom[] = [];
const makeRoom = (mode = GameMode.DEATHMATCH, maxPlayers = 8) => {
    const room = new GameRoom({ mode, map: MapId.DEFAULT, maxPlayers });
    rooms.push(room);
    return room;
};
afterEach(() => rooms.splice(0).forEach(r => r.dispose()));

describe('GameRoom', () => {
    it('replaces a bot when a player joins', () => {
        const room = makeRoom();
        const before = room.state.players.length;
        expect(room.join('s1', join)).toEqual({ ok: true });
        expect(room.state.players.length).toBe(before);
        expect(room.state.players.filter(p => p.type === 'player').map(p => p.id)).toEqual(['s1']);
    });

    it('rejects a second join from the same socket', () => {
        const room = makeRoom();
        room.join('s1', join);
        expect(room.join('s1', join)).toEqual({ ok: false, reason: 'already_joined' });
        expect(room.state.players.filter(p => p.id === 's1').length).toBe(1);
    });

    it('rejects joins when full', () => {
        const room = makeRoom(GameMode.DEATHMATCH, 1);
        room.join('s1', join);
        expect(room.join('s2', join)).toEqual({ ok: false, reason: 'full' });
    });

    it('balances teams in team modes', () => {
        const room = makeRoom(GameMode.CTF);
        room.join('s1', join);
        room.join('s2', join);
        const teams = room.state.players.filter(p => p.type === 'player').map(p => p.team).sort();
        expect(teams).toEqual([Team.BLUE, Team.RED]);
    });

    it('moves the player according to queued input and acknowledges it', () => {
        const room = makeRoom();
        room.join('s1', join);
        const p = room.state.players.find(pl => pl.id === 's1')!;
        const startX = p.pos.x;
        for (let seq = 1; seq <= 60; seq++) {
            room.pushInput('s1', { keys: { KeyD: true }, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence: seq, timestamp: seq });
            room.tick();
        }
        expect(p.pos.x).toBeGreaterThan(startX);
        expect(p.lastProcessedInput).toBe(60);
    });

    it('collects gameplay events and snapshots without cosmetic data', () => {
        const room = makeRoom();
        room.join('s1', join);
        const p = room.state.players.find(pl => pl.id === 's1')!;
        p.health = 1;
        p.pos = { x: 0, y: 3000 }; // below the kill plane
        room.tick();
        expect(room.drainEvents().some(e => e.type === 'KILL')).toBe(false); // world death has no attacker
        const snap = room.snapshot(123) as Record<string, unknown>;
        expect(snap.serverTime).toBe(123);
        expect(snap.particles).toBeUndefined();
        expect(snap.decals).toBeUndefined();
    });

    it('removes the player and body on leave', () => {
        const room = makeRoom();
        room.join('s1', join);
        room.leave('s1');
        expect(room.state.players.some(p => p.id === 's1')).toBe(false);
        expect(room.pushInput('s1', { keys: {}, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence: 1, timestamp: 1 })).toBe(false);
    });
});
