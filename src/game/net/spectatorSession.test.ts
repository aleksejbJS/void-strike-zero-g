import { describe, it, expect, afterEach, vi } from 'vitest';
import { MSG } from './protocol';
import { gameEvents, GameEvent } from '../systems/events';
import { presetBuild } from '../build/buildPresets';
import { Team } from '../../types';
import { setup, watching, watchInfo, snapshotOf, at } from './spectatorTestKit';
import type { Cover } from '../cover/coverTypes';

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

    it('tells the caller about every snapshot as it arrives, before any tick', () => {
        const { socket, cb, info } = watching();
        expect(cb.onSnapshot).toHaveBeenCalledWith(info.snapshot);
        const next = { ...snapshotOf([at('a', 10)]), matchEndsAt: Date.now() + 5000 };
        socket.fire(MSG.SNAPSHOT, next);
        expect(cb.onSnapshot).toHaveBeenCalledTimes(2);
        expect(cb.onSnapshot).toHaveBeenLastCalledWith(next);
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

const watchingCover = (cover: Cover[]) => {
    const ctx = setup();
    const info = { ...watchInfo(), cover };
    ctx.socket.fire('connect');
    ctx.socket.fire(MSG.WATCHING, info);
    ctx.session.tick(ctx.state, performance.now() + 500);
    return { ...ctx, info };
};

describe('SpectatorSession: cover', () => {
    const crates = () => [
        { id: 'c1', kind: 'wood' as const, pos: { x: 100, y: 400 }, hp: 150 },
        { id: 'c2', kind: 'barrel' as const, pos: { x: 300, y: 400 }, hp: 80 },
    ];

    it('takes the layout from the host reply and applies the status of each snapshot', () => {
        const { socket, session, state, info } = watchingCover(crates());
        expect(state.cover!.map(c => c.id)).toEqual(['c1', 'c2']);

        socket.fire(MSG.SNAPSHOT, { ...snapshotOf([]), coverStatus: [{ id: 'c1', hp: 0, returnsAt: Date.now() + 30000 }, { id: 'ghost', hp: 0 }] });
        session.tick(state, performance.now() + 600);

        expect(state.cover![0].hp).toBe(0);
        expect(state.cover![0].returnsAt).toBeGreaterThan(Date.now());
        expect(state.cover![1].hp).toBe(80);
        expect('coverStatus' in state).toBe(false);
        expect(info.cover).toBe(state.cover);
    });

    it('a host without cover leaves the tile with an empty list', () => {
        const { state } = watching([at('a', 100)]);
        expect(state.cover ?? []).toEqual([]);
    });
});
