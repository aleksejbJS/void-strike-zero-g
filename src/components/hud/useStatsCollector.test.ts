import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameMode, GameState } from '../../types';
import { onProgressChanged } from '../../account/progressEvents';
import { exportStats } from '../../game/stats/lifetimeStats';
import { useStatsCollector } from './useStatsCollector';

// Only the fields the collector reads.
const makeState = (fields: Partial<GameState> = {}) => ({
    current: {
        mode: GameMode.DEATHMATCH,
        players: [{ id: 'me' }, { id: 'bot' }],
        statsSession: 's1',
        playerStats: { me: {}, bot: { kills: 9 } },
        ...fields,
    } as unknown as GameState,
});

describe('useStatsCollector', () => {
    let store: Record<string, string>;
    let visibility: string;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key in store ? store[key] : null));
        (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { store[key] = value; });
        // Seeded (empty) counters: nothing to carry over from achievements.
        store.lifetimeStats = '{}';
        visibility = 'visible';
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState);
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const run = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
    const mount = (state: ReturnType<typeof makeState>) => renderHook(() => useStatsCollector(state, { current: 'me' }));

    it('credits a new kill of the local player once, and not the other players', () => {
        const state = makeState();
        mount(state);
        run(250);
        expect(exportStats().botKills ?? 0).toBe(0);

        state.current.playerStats!.me = { botKills: 1 };
        run(250);
        expect(exportStats().botKills).toBe(1);
        run(2000); // the same snapshot keeps arriving
        expect(exportStats().botKills).toBe(1);
        expect(exportStats().kills ?? 0).toBe(0); // the bot's kills are not ours
    });

    it('credits only what grew since the last look', () => {
        const state = makeState();
        mount(state);
        state.current.playerStats!.me = { kills: 2, hookUses: 1 };
        run(250);
        state.current.playerStats!.me = { kills: 3, hookUses: 1 };
        run(250);
        expect(exportStats()).toMatchObject({ kills: 3, hookUses: 1 });
    });

    it('credits nothing from the counters of a state without a session', () => {
        const state = makeState({ statsSession: undefined });
        mount(state);
        state.current.playerStats!.me = { kills: 2 };
        run(1000);
        expect(exportStats().kills ?? 0).toBe(0);
        expect(exportStats().playMs).toBeGreaterThan(0); // play time still counts
    });

    it('counts play time while the local player is in the match', () => {
        const state = makeState();
        mount(state);
        run(2000);
        expect(exportStats().playMs).toBe(2000);
    });

    it('stops counting play time once the match is over', () => {
        const state = makeState();
        mount(state);
        run(1000);
        expect(exportStats().playMs).toBe(1000);
        state.current.matchEndsAt = 10_000;
        run(3000);
        expect(exportStats().playMs).toBe(1000);

        // Play resumes without crediting the time spent on the end screen.
        state.current.matchEndsAt = undefined;
        run(1000);
        expect(exportStats().playMs).toBe(2000);
    });

    it('does not count play time in a hidden tab', () => {
        const state = makeState();
        mount(state);
        run(1000);
        visibility = 'hidden';
        run(5000);
        expect(exportStats().playMs).toBe(1000);
        visibility = 'visible';
        run(1000);
        expect(exportStats().playMs).toBe(2000);
    });

    it('does not count play time while the local player is not in the room', () => {
        const state = makeState({ players: [] });
        mount(state);
        run(2000);
        expect(exportStats().playMs ?? 0).toBe(0);
    });

    it('signals a progress change on unmount only if something was credited', () => {
        const changed = vi.fn();
        const stop = onProgressChanged(changed);

        const idle = makeState({ players: [] });
        const first = mount(idle);
        run(1000);
        first.unmount();
        expect(changed).not.toHaveBeenCalled();

        const state = makeState();
        const second = mount(state);
        run(500);
        expect(changed).not.toHaveBeenCalled(); // not while playing: only when leaving
        second.unmount();
        expect(changed).toHaveBeenCalledTimes(1);
        stop();
    });

    it('stops polling when the screen is left', () => {
        const state = makeState();
        const { unmount } = mount(state);
        run(1000);
        unmount();
        state.current.playerStats!.me = { kills: 4 };
        run(2000);
        expect(exportStats().kills ?? 0).toBe(0);
        expect(exportStats().playMs).toBe(1000);
    });

    it('starts counting from zero again for a new session (offline game after offline game)', () => {
        const state = makeState();
        mount(state);
        state.current.playerStats!.me = { kills: 5 };
        run(250);
        state.current.statsSession = 's2';
        state.current.playerStats = { me: { kills: 2 } };
        run(250);
        expect(exportStats().kills).toBe(7);
    });
});
