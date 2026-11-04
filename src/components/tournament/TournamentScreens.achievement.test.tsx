import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { achievementManager, type Achievement } from '../../game/systems/achievements';
import { listOpen, loadListDetails, loadSnapshot } from '../../tournament/tournamentApi';
import type { TournamentSnapshot } from '../../tournament/types';
import { TournamentScreens } from './TournamentScreens';

vi.mock('../../tournament/tournamentApi', () => ({
    loadSnapshot: vi.fn(), resolveStale: vi.fn(), listOpen: vi.fn(), loadListDetails: vi.fn(), matchSeen: vi.fn(),
}));
vi.mock('../../tournament/tournamentFeed', () => ({ watchTournament: () => () => {} }));
vi.mock('../../tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: () => null, forgetTicket: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const running: TournamentSnapshot = {
    tournament: { id: T_ID, name: 'Cup', status: 'running', size: 4, creatorSeat: 0, createdAt: '', startedAt: null, finishedAt: null, championSeat: null },
    seats: [],
    matches: [],
};
const champion = { id: 'tournament_champion', name: 'Champion', description: 'Win a tournament', reward: { xp: 500 } } as Achievement;

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
let listeners: ((a: Achievement) => void)[];
let unsubscribe: Mock;

const mount = () => render(
    <UIProvider><Spy />
        <AccountContext.Provider value={stubAccount({ status: 'guest' })}><TournamentScreens onCustomize={vi.fn()} /></AccountContext.Provider>
    </UIProvider>,
);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(listOpen).mockReset().mockResolvedValue([]);
    vi.mocked(loadListDetails).mockReset().mockResolvedValue({ seats: [], matches: [] });
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(running);
    listeners = [];
    unsubscribe = vi.fn();
    vi.spyOn(achievementManager, 'onAchievementUnlocked').mockImplementation(listener => {
        listeners.push(listener);
        return unsubscribe;
    });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TournamentScreens achievement toast', () => {
    it('shows "Achievement unlocked" on the bracket and hides it after 5 s', async () => {
        mount();
        act(() => store.actions.openTournament(T_ID));
        await act(async () => {});
        act(() => listeners.forEach(l => l(champion)));
        expect(screen.getByText('Achievement unlocked')).toBeInTheDocument();
        expect(screen.getByText('Champion')).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(5000); });
        expect(screen.queryByText('Achievement unlocked')).not.toBeInTheDocument();
    });

    it('listens once for all tournament screens and stops listening on unmount', async () => {
        const view = mount();
        act(() => store.actions.openTournament(T_ID));
        await act(async () => {});
        act(() => store.actions.openWatch(T_ID));
        await act(async () => {});
        expect(listeners).toHaveLength(1);
        act(() => listeners[0](champion));
        expect(screen.getByText('Achievement unlocked')).toBeInTheDocument();
        view.unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
