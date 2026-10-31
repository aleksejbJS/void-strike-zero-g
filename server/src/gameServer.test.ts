// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as connect, Socket as ClientSocket } from 'socket.io-client';
import { GameRoom } from '../../src/game/net/room';
import { MSG, JoinAccepted, Snapshot } from '../../src/game/net/protocol';
import { GameMode, MapId } from '../../src/types';
import { startGameServer } from './gameServer';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' };

// Poll until `check` passes or time runs out (avoids fixed sleeps that flake under load)
const waitFor = async (check: () => boolean, timeoutMs = 3000) => {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
        await new Promise(r => setTimeout(r, 20));
    }
};

const once = <T>(socket: ClientSocket, event: string, timeoutMs = 2000) =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
        socket.once(event, (data: T) => { clearTimeout(timer); resolve(data); });
    });

describe('game server (socket.io integration)', () => {
    let http: HttpServer;
    let io: Server;
    let room: GameRoom;
    let stop: () => void;
    let url: string;
    const clients: ClientSocket[] = [];

    const client = () => {
        const c = connect(url, { transports: ['websocket'], forceNew: true });
        clients.push(c);
        return c;
    };

    beforeEach(async () => {
        http = createServer();
        io = new Server(http, { maxHttpBufferSize: 16 * 1024 });
        room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2 });
        stop = startGameServer(io, room);
        await new Promise<void>(r => http.listen(0, r));
        url = `http://localhost:${(http.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        clients.splice(0).forEach(c => c.disconnect());
        stop();
        room.dispose();
        await new Promise<void>(r => io.close(() => r()));
    });

    it('accepts two players who then appear in snapshots without cosmetic data', async () => {
        const a = client();
        const b = client();
        a.emit(MSG.JOIN, join);
        b.emit(MSG.JOIN, { ...join, name: 'Bob' });
        const [ja, jb] = await Promise.all([once<JoinAccepted>(a, MSG.JOINED), once<JoinAccepted>(b, MSG.JOINED)]);
        expect(ja.map).toBe(MapId.DEFAULT);

        const snap = await once<Snapshot & Record<string, unknown>>(a, MSG.SNAPSHOT);
        const ids = snap.players.map(p => p.id);
        expect(ids).toContain(ja.id);
        expect(ids).toContain(jb.id);
        expect(snap.particles).toBeUndefined();
    });

    it('survives malformed joins and rejects them', async () => {
        const c = client();
        c.emit(MSG.JOIN);
        expect(await once(c, MSG.JOIN_REJECTED)).toEqual({ reason: 'invalid' });
        c.emit(MSG.JOIN, null);
        expect(await once(c, MSG.JOIN_REJECTED)).toEqual({ reason: 'invalid' });
        // Server still works afterwards
        c.emit(MSG.JOIN, join);
        await once(c, MSG.JOINED);
    });

    it('rejects a repeat join and a join over the player limit', async () => {
        const a = client();
        a.emit(MSG.JOIN, join);
        await once(a, MSG.JOINED);
        a.emit(MSG.JOIN, join);
        expect(await once(a, MSG.JOIN_REJECTED)).toEqual({ reason: 'already_joined' });

        const b = client();
        b.emit(MSG.JOIN, join);
        await once(b, MSG.JOINED);
        const c = client();
        c.emit(MSG.JOIN, join);
        expect(await once(c, MSG.JOIN_REJECTED)).toEqual({ reason: 'full' });
    });

    it('moves the player from inputs and acknowledges the latest sequence', async () => {
        const a = client();
        a.emit(MSG.JOIN, join);
        const { id } = await once<JoinAccepted>(a, MSG.JOINED);
        const startX = room.state.players.find(p => p.id === id)!.pos.x;

        for (let seq = 1; seq <= 60; seq++) {
            a.emit(MSG.INPUT, { keys: { KeyD: true }, mouse: { x: 0, y: 0 }, mousePressed: false, hookPressed: false, sequence: seq });
        }
        await waitFor(() => room.state.players.find(p => p.id === id)!.lastProcessedInput === 60);

        const snap = await once<Snapshot>(a, MSG.SNAPSHOT);
        const me = snap.players.find(p => p.id === id)!;
        expect(me.pos.x).toBeGreaterThan(startX);
        expect(me.lastProcessedInput).toBe(60);
    });

    it('removes the player when they disconnect', async () => {
        const a = client();
        a.emit(MSG.JOIN, join);
        const { id } = await once<JoinAccepted>(a, MSG.JOINED);
        a.disconnect();
        await waitFor(() => !room.state.players.some(p => p.id === id));
    });
});
