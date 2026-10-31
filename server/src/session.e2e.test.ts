// @vitest-environment node
// End-to-end: real server + two real ClientSessions with prediction and interpolation.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { GameRoom } from '../../src/game/net/room';
import { ClientSession, TickControls } from '../../src/game/net/clientSession';
import { createRoomState } from '../../src/game/net/roomSetup';
import { MatterPhysicsEngine } from '../../src/game/physics/MatterEngine';
import { GameMode, GameState, MapId } from '../../src/types';
import { startGameServer } from './gameServer';
import { io as connect } from 'socket.io-client';

const join = (name: string) => ({ name, color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface TestClient { session: ClientSession; state: GameState; joined: Promise<void> }

const makeClient = (url: string, name: string): TestClient => {
    const state = createRoomState(GameMode.DEATHMATCH, MapId.DEFAULT);
    state.platforms = [];
    const physics = new MatterPhysicsEngine();
    let resolveJoined!: () => void;
    const joined = new Promise<void>(r => { resolveJoined = r; });
    const session: ClientSession = new ClientSession(connect(url, { reconnection: false }), join(name), physics, {
        onJoined: info => { session.setupWorld(state, info); resolveJoined(); },
        onRejected: reason => { throw new Error(`rejected: ${reason}`); },
        onConnectionError: message => { throw new Error(`connection error: ${message}`); },
        onEvents: () => {},
        onDisconnected: () => {},
    });
    return { session, state, joined };
};

const idle: TickControls = { keys: {}, aim: { x: 0, y: 0 }, mousePressed: false, hookPressed: false };

describe('online session end-to-end', () => {
    let http: HttpServer;
    let io: Server;
    let room: GameRoom;
    let stop: () => void;
    let url: string;
    const clients: TestClient[] = [];

    beforeEach(async () => {
        http = createServer();
        io = new Server(http);
        room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4 });
        stop = startGameServer(io, room);
        await new Promise<void>(r => http.listen(0, r));
        url = `http://localhost:${(http.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        clients.splice(0).forEach(c => c.session.dispose());
        stop();
        room.dispose();
        await new Promise<void>(r => io.close(() => r()));
    });

    it('predicts own movement close to the server and shows it to the other player', async () => {
        const a = makeClient(url, 'Alice');
        const b = makeClient(url, 'Bob');
        clients.push(a, b);
        await Promise.all([a.joined, b.joined]);
        const aliceId = a.session.localId!;

        // Let both players land, then Alice runs right for ~1.5s while Bob idles
        const runTicks = async (ticks: number, aliceControls: TickControls) => {
            for (let i = 0; i < ticks; i++) {
                const now = performance.now();
                a.session.tick(a.state, aliceControls, now);
                b.session.tick(b.state, idle, now);
                await sleep(8);
            }
        };
        await runTicks(120, idle);
        const startX = room.state.players.find(p => p.id === aliceId)!.pos.x;
        await runTicks(180, { ...idle, keys: { KeyD: true } });

        const xs = () => ({
            server: room.state.players.find(p => p.id === aliceId)!.pos.x,
            predicted: a.state.players.find(p => p.id === aliceId)!.pos.x,
            seenByBob: b.state.players.find(p => p.id === aliceId)!.pos.x,
        });
        const converged = () => {
            const x = xs();
            return Math.abs(x.predicted - x.server) < 15 && Math.abs(x.seenByBob - x.server) < 15;
        };
        // Keep ticking idle until snapshots and corrections settle (bounded, load-tolerant)
        for (let i = 0; i < 400 && !converged(); i += 20) await runTicks(20, idle);

        const x = xs();
        expect(x.server).toBeGreaterThan(startX + 50);
        expect(Math.abs(x.predicted - x.server)).toBeLessThan(15);
        expect(Math.abs(x.seenByBob - x.server)).toBeLessThan(15);
    }, 20000);
});
