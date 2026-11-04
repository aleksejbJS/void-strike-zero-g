// Shared test helpers for the SpectatorSession tests: a fake host link and ready-made worlds.

import { vi } from 'vitest';
import { SpectatorSession, SpectatorCallbacks } from './spectatorSession';
import { EmitterSocket } from './sessionSocket';
import { MSG, Snapshot, WatchAccepted } from './protocol';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { Entity, GameMode, Team } from '../../types';

/** Records what the session sends and lets a test play the host's part. */
export class FakeSocket extends EmitterSocket {
    sent: { event: string; data: unknown }[] = [];
    emit(event: string, data?: unknown) { this.sent.push({ event, data }); }
    disconnect() {}
    fire(event: string, data?: unknown) { this.dispatch(event, data); }
}

const platform = { id: 'floor', x: 0, y: 500, w: 800, h: 20 } as any;

// What a host sends: the dynamic parts of the state (platforms travel separately, in WatchAccepted)
export const snapshotOf = (players: Entity[]): Snapshot => {
    const { platforms: _platforms, ...dynamic } = createMockState(GameMode.DEATHMATCH);
    return { ...dynamic, players, serverTime: Date.now() } as any;
};

export const watchInfo = (players: Entity[] = []): WatchAccepted => ({
    mode: GameMode.DEATHMATCH,
    map: 'arena' as any,
    platforms: [platform],
    snapshot: snapshotOf(players),
});

export const at = (id: string, x: number, score = 0): Entity => ({ ...createMockPlayer(id, Team.NONE), pos: { x, y: 300 }, score });

export const setup = () => {
    const socket = new FakeSocket();
    const cb = { onWatching: vi.fn(), onRejected: vi.fn(), onEnded: vi.fn(), onSound: vi.fn(), onSnapshot: vi.fn() } satisfies SpectatorCallbacks;
    const session = new SpectatorSession(socket, cb);
    return { socket, cb, session, state: createMockState(GameMode.DEATHMATCH) };
};

/** Connect, get accepted and run one tick so the world lands in `state`. */
export const watching = (players: Entity[] = []) => {
    const ctx = setup();
    const info = watchInfo(players);
    ctx.socket.fire('connect');
    ctx.socket.fire(MSG.WATCHING, info);
    ctx.session.tick(ctx.state, performance.now() + 500);
    return { ...ctx, info };
};
