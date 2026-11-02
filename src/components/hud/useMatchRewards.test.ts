import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameMode, GameState } from '../../types';
import { useMatchRewards } from './useMatchRewards';

// Only the fields detectMatchEnd reads.
const makeState = (fields: Partial<GameState> = {}) => ({
    current: { mode: GameMode.DEATHMATCH, players: [{ id: 'me' }, { id: 'bot' }], ...fields } as unknown as GameState,
});

describe('useMatchRewards', () => {
    let store: Record<string, string>;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key in store ? store[key] : null));
        (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { store[key] = value; });
        vi.useFakeTimers();
    });
    afterEach(() => { vi.useRealTimers(); });

    const run = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

    it('gives XP once while the result stays on screen', () => {
        const state = makeState();
        const { result } = renderHook(() => useMatchRewards(state, { current: 'me' }));
        expect(result.current).toBeNull();

        state.current.matchEndsAt = 10_000;
        run(250);
        expect(store.fighterXp).toBe('20');
        const reward = result.current;
        expect(reward?.gained).toBe(20);

        // An online client re-shifts matchEndsAt by the clock offset on every snapshot: the key keeps changing.
        for (let i = 1; i <= 12; i++) {
            state.current.matchEndsAt = 10_000 + (i % 4);
            run(250);
        }
        expect(store.fighterXp).toBe('20');
        expect(result.current).toBe(reward);
    });

    it('gives XP again for the next match', () => {
        const state = makeState();
        const { result } = renderHook(() => useMatchRewards(state, { current: 'me' }));

        state.current.matchEndsAt = 10_000;
        run(1000);
        expect(store.fighterXp).toBe('20');
        expect(result.current).not.toBeNull();

        // Play resumes: the result is gone and the reward with it.
        state.current.matchEndsAt = undefined;
        run(500);
        expect(result.current).toBeNull();

        // The next match ends with the very same key (Gun Game keys can repeat): still a new episode.
        state.current.matchEndsAt = 10_000;
        run(1000);
        expect(store.fighterXp).toBe('40');
        expect(result.current?.gained).toBe(20);
    });

    it('a win gives 50', () => {
        const state = makeState({ matchEndsAt: 10_000, matchWinner: { playerId: 'me' } });
        const { result } = renderHook(() => useMatchRewards(state, { current: 'me' }));
        run(250);
        expect(store.fighterXp).toBe('50');
        expect(result.current).toMatchObject({ gained: 50, levelBefore: 1, levelAfter: 2 });
        expect(result.current?.unlocked.map(u => `${u.slot}:${u.id}`)).toEqual(['ears:wolf']);
    });

    it('stops polling when the screen is left', () => {
        const state = makeState({ matchEndsAt: 10_000 });
        const { unmount } = renderHook(() => useMatchRewards(state, { current: 'me' }));
        run(250);
        unmount();
        state.current.matchEndsAt = undefined;
        run(500);
        state.current.matchEndsAt = 20_000;
        run(1000);
        expect(store.fighterXp).toBe('20');
    });
});
