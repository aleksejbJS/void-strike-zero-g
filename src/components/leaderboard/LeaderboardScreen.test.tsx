import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AccountContext, type AccountState } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { fetchBoard, LeaderboardError, type Board, type BoardRow } from '../../leaderboard/leaderboardApi';
import { LeaderboardScreen } from './LeaderboardScreen';

vi.mock('../../leaderboard/leaderboardApi', async importOriginal => ({
    ...(await importOriginal<typeof import('../../leaderboard/leaderboardApi')>()),
    fetchBoard: vi.fn(),
}));
const fetchMock = vi.mocked(fetchBoard);

const NAMES = ['Kosmonavt', 'Вихрь', 'Alex', 'Мясник', 'orbit', 'Танкист', 'jetfox', 'Лёд', 'hookline', 'Пила'];
const topTen = (): BoardRow[] => NAMES.map((nickname, i) => ({ rank: i + 1, nickname, value: 1000 - i * 50 }));

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
};

const mount = async (account: AccountState = stubAccount({ status: 'loggedIn', nickname: 'Alex' })) => {
    const onBack = vi.fn();
    const onRegister = vi.fn();
    await act(async () => {
        render(<AccountContext.Provider value={account}><LeaderboardScreen onBack={onBack} onRegister={onRegister} /></AccountContext.Provider>);
    });
    return { onBack, onRegister };
};

const table = () => screen.getByRole('table');
const ownRow = () => within(table()).getAllByRole('row').find(row => row.getAttribute('aria-current') === 'true');

beforeEach(() => {
    fetchMock.mockReset();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
});

describe('LeaderboardScreen', () => {
    it('opens on the XP board for this week, and Back calls onBack', async () => {
        fetchMock.mockResolvedValue({ top: topTen(), me: { rank: 3, value: 900 } });
        const { onBack } = await mount();
        expect(fetchMock).toHaveBeenCalledWith('xp', 'week');
        expect(screen.getByRole('heading', { level: 1, name: 'Top players' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'XP' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: '← Menu' }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('outside the top ten: a gap, then the own row with its place and value', async () => {
        fetchMock.mockResolvedValue({ top: topTen().map(row => ({ ...row, nickname: `p${row.rank}` })), me: { rank: 37, value: 214 } });
        await mount();
        expect(within(table()).getByText('· · ·')).toBeInTheDocument();
        const own = ownRow() as HTMLElement;
        expect(own).toHaveTextContent('You · Alex');
        expect(within(own).getByText('37')).toBeInTheDocument();
        expect(within(own).getByText('214')).toBeInTheDocument();
    });

    it('inside the top ten: the own row is highlighted in place, no gap', async () => {
        fetchMock.mockResolvedValue({ top: topTen(), me: { rank: 3, value: 900 } });
        await mount();
        expect(within(table()).queryByText('· · ·')).not.toBeInTheDocument();
        const own = ownRow() as HTMLElement;
        expect(within(own).getByText('3')).toBeInTheDocument();
        expect(within(own).getByText('Alex')).toBeInTheDocument();
        expect(screen.queryByText(/You ·/)).not.toBeInTheDocument();
    });

    it('inside the shown ranks but under another nickname: no gap and no second own row', async () => {
        // A stale own name (just renamed): the server says rank 3, yet no shown row carries the viewer's nickname.
        fetchMock.mockResolvedValue({ top: topTen().map(row => ({ ...row, nickname: `p${row.rank}` })), me: { rank: 3, value: 900 } });
        await mount();
        expect(within(table()).queryByText('· · ·')).not.toBeInTheDocument();
        expect(ownRow()).toBeUndefined();
        expect(screen.queryByText(/You ·/)).not.toBeInTheDocument();
        expect(within(table()).getAllByRole('row').filter(row => /p\d/.test(row.textContent ?? ''))).toHaveLength(10); // only the ten ranked rows
    });

    it('logged in without a score: says not ranked yet', async () => {
        fetchMock.mockResolvedValue({ top: topTen().map(row => ({ ...row, nickname: `p${row.rank}` })), me: null });
        await mount();
        expect(screen.getByText('Not ranked yet')).toBeInTheDocument();
        expect(ownRow()).toBeUndefined();
    });

    it('guest: invites to register instead of an own row', async () => {
        fetchMock.mockResolvedValue({ top: topTen(), me: null });
        const { onRegister } = await mount(stubAccount({ status: 'guest' }));
        expect(screen.getByText('Register to get on the board')).toBeInTheDocument();
        expect(screen.queryByText('Not ranked yet')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        expect(onRegister).toHaveBeenCalledTimes(1);
    });

    it('switching the category and the period loads that board', async () => {
        fetchMock.mockResolvedValue({ top: topTen(), me: null });
        await mount();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bot kills' })); });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'This month' })); });
        expect(fetchMock).toHaveBeenLastCalledWith('botKills', 'month');
        expect(screen.getByRole('button', { name: 'Bot kills' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('columnheader', { name: 'Bot kills' })).toBeInTheDocument();
    });

    it('ignores an answer that arrives after the category was switched', async () => {
        const slow = deferred<Board>();
        fetchMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ top: [{ rank: 1, nickname: 'killer', value: 5 }], me: null });
        await mount();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Kills' })); });
        await act(async () => { slow.resolve({ top: [{ rank: 1, nickname: 'xpLord', value: 99 }], me: null }); });
        expect(screen.getByText('killer')).toBeInTheDocument();
        expect(screen.queryByText('xpLord')).not.toBeInTheDocument();
    });

    it('shows Loading while the board is on its way', async () => {
        fetchMock.mockReturnValue(deferred<Board>().promise);
        await mount();
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('a failed load shows the error, Retry loads again', async () => {
        fetchMock.mockRejectedValueOnce(new LeaderboardError('network')).mockResolvedValueOnce({ top: topTen(), me: null });
        await mount();
        expect(screen.getByText('Could not load the board.')).toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('Could not load the board.')).not.toBeInTheDocument();
        expect(screen.getByText('Kosmonavt')).toBeInTheDocument();
    });

    it('an empty board says nobody is on it yet', async () => {
        fetchMock.mockResolvedValue({ top: [], me: null });
        await mount();
        expect(screen.getByText('Nobody on this board yet')).toBeInTheDocument();
    });

    it('speaks Russian', async () => {
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => (key === 'gameLanguage' ? 'ru' : null));
        fetchMock.mockResolvedValue({ top: topTen().map(row => ({ ...row, nickname: `p${row.rank}` })), me: { rank: 37, value: 214 } });
        await mount();
        expect(screen.getByRole('heading', { level: 1, name: 'Топ игроков' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Неделя' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Победы над ботами' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Игрок' })).toBeInTheDocument();
        expect(ownRow()).toHaveTextContent('Вы · Alex');
    });
});
