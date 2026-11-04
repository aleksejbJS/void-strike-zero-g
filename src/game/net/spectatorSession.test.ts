import { describe, it, expect, afterEach, vi } from 'vitest';
import { SpectatorSession, SpectatorCallbacks } from './spectatorSession';
import { EmitterSocket } from './sessionSocket';
import { MSG, Snapshot, WatchAccepted } from './protocol';
import { gameEvents, GameEvent } from '../systems/events';
import { presetBuild } from '../build/buildPresets';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { Entity, GameMode, Team } from '../../types';

/** Records what the session sends and lets a test play the host's part. */
class FakeSocket extends EmitterSocket {
    sent: { event: string; data: unknown }[] = [];
    emit(event: string, data?: unknown) { this.sent.push({ event, data }); }
    disconnect() {}
    fire(event: string, data?: unknown) { this.dispatch(event, data); }
}

const platform = { id: 'floor', x: 0, y: 500, w: 800, h: 20 } as any;

// What a host sends: the dynamic parts of the state (platforms travel separately, in WatchAccepted)
const snapshotOf = (players: Entity[]): Snapshot => {
    const { platforms: _platforms, ...dynamic } = createMockState(GameMode.DEATHMATCH);
    return { ...dynamic, players, serverTime: Date.now() } as any;
};

const watchInfo = (players: Entity[] = []): WatchAccepted => ({
    mode: GameMode.DEATHMATCH,
    map: 'arena' as any,
    platforms: [platform],
    snapshot: snapshotOf(players),
});

const at = (id: string, x: number, score = 0): Entity => ({ ...createMockPlayer(id, Team.NONE), pos: { x, y: 300 }, score });

const setup = () => {
    const socket = new FakeSocket();
    const cb = { onWatching: vi.fn(), onRejected: vi.fn(), onEnded: vi.fn(), onSound: vi.fn() } satisfies SpectatorCallbacks;
    const session = new SpectatorSession(socket, cb);
    return { socket, cb, session, state: createMockState(GameMode.DEATHMATCH) };
};

/** Connect, get accepted and run one tick so the world lands in `state`. */
const watching = (players: Entity[] = []) => {
    const ctx = setup();
    const info = watchInfo(players);
    ctx.socket.fire('connect');
    ctx.socket.fire(MSG.WATCHING, info);
    ctx.session.tick(ctx.state, performance.now() + 500);
    return { ...ctx, info };
};

afterEach(() => { vi.restoreAllMocks(); });

describe('SpectatorSession: joining', () => {
    it('asks to watch as soon as the socket connects', () => {
        const { socket } = setup();
        expect(socket.sent).toEqual([]);
        socket.fire('connect');
        expect(socket.sent).toEqual([{ event: MSG.WATCH, data: {} }]);
    });

    it('hands the host reply to onWatching and fills the world on the next tick', () => {
        const { cb, state, info } = watching([at('a', 100)]);
        expect(cb.onWatching).toHaveBeenCalledWith(info);
        expect(state.platforms).toEqual(info.platforms);
        expect(state.players.map(p => p.id)).toEqual(['a']);
    });

    it('reports a rejection', () => {
        const { socket, cb } = setup();
        socket.fire(MSG.JOIN_REJECTED, { reason: 'spectators_full' });
        expect(cb.onRejected).toHaveBeenCalledWith('spectators_full');
    });

    it('checks builds from the host before they are drawn', () => {
        const hostile = { ...presetBuild('wolf'), helmet: 'x' };
        const { state } = watching([{ ...at('a', 0), skinId: 'wolf', build: hostile as any }]);
        expect(state.players[0].build!.helmet).toBe(presetBuild('wolf').helmet);
    });
});

describe('SpectatorSession: events stay on this tile', () => {
    const blood: GameEvent = { type: 'EFFECT', effect: 'blood', x: 50, y: 50, count: 6 };

    it('draws an effect into its own state and never touches the global event bus', () => {
        const onBus = vi.fn();
        const unsubscribe = gameEvents.on(onBus);
        const { socket, session, state } = watching();
        expect(state.particles).toHaveLength(0);

        socket.fire(MSG.EVENTS, [blood]);
        session.tick(state, performance.now() + 500);

        expect(state.particles.length).toBeGreaterThan(0);
        expect(onBus).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('sends sound events to onSound and draws nothing for them', () => {
        const { socket, cb, session, state } = watching();
        const sound: GameEvent = { type: 'SOUND', sound: 'shoot', subtype: 'rocket' };

        socket.fire(MSG.EVENTS, [sound]);
        session.tick(state, performance.now() + 500);

        expect(cb.onSound).toHaveBeenCalledWith(sound);
        expect(state.particles).toHaveLength(0);
    });

    it('ignores the kill feed and flag banners, which tiles do not show', () => {
        const { socket, cb, session, state } = watching();
        socket.fire(MSG.EVENTS, [
            { type: 'KILL', killer: 'a', killerColor: '#fff', weapon: 'mg', victim: 'b', victimColor: '#000' },
            { type: 'FLAG', kind: 'ctf', action: 'grabbed', team: Team.RED },
        ]);
        expect(() => session.tick(state, performance.now() + 500)).not.toThrow();
        expect(cb.onSound).not.toHaveBeenCalled();
        expect(state.particles).toHaveLength(0);
    });
});

describe('SpectatorSession: connection loss', () => {
    it('reports a disconnect after watching started', () => {
        const { socket, cb } = watching();
        socket.fire('disconnect');
        expect(cb.onEnded).toHaveBeenCalledWith('disconnected');
    });

    it('stays quiet about a disconnect that came before the host accepted (the rejection is the news)', () => {
        const { socket, cb } = setup();
        socket.fire('disconnect');
        expect(cb.onEnded).not.toHaveBeenCalled();
    });

    it('reports a failed connection', () => {
        const { socket, cb } = setup();
        socket.fire('connect_error', new Error('timeout'));
        expect(cb.onEnded).toHaveBeenCalledWith('connection_error');
    });

    it('stops listening once disposed', () => {
        const { socket, cb, session } = watching();
        session.dispose();
        socket.fire('disconnect');
        expect(cb.onEnded).not.toHaveBeenCalled();
    });
});

describe('SpectatorSession: tick', () => {
    it('interpolates every player, because a spectator owns none', () => {
        const times = [1000, 1100];
        const now = vi.spyOn(performance, 'now').mockImplementation(() => times.shift() ?? 1100);
        const { socket, session, state } = setup();
        socket.fire(MSG.WATCHING, watchInfo([at('a', 0), at('b', 200)]));
        socket.fire(MSG.SNAPSHOT, snapshotOf([at('a', 100), at('b', 400)]));
        now.mockReturnValue(1100);

        session.tick(state, 1150); // renders 100 ms back: halfway between the two snapshots

        expect(state.players.map(p => p.pos.x)).toEqual([50, 300]);
    });

    it('follows the score leader while followId is null', () => {
        const { session, state } = watching([at('behind', 1000, 1), at('leader', -1000, 5)]);
        expect(session.followId).toBeNull();
        state.camera.x = 0;

        session.tick(state, performance.now() + 500);

        expect(state.camera.x).toBeLessThan(0);
    });

    it('follows the chosen player, and the leader again if that player is gone', () => {
        const { session, state } = watching([at('behind', 1000, 1), at('leader', -1000, 5)]);
        session.followId = 'behind';
        state.camera.x = 0;
        session.tick(state, performance.now() + 500);
        expect(state.camera.x).toBeGreaterThan(0);

        session.followId = 'left-already';
        state.camera.x = 0;
        session.tick(state, performance.now() + 500);
        expect(state.camera.x).toBeLessThan(0);
    });
});
