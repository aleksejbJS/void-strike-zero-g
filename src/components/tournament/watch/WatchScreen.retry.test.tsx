import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, screen } from '@testing-library/react';
import { makeSnapshot, publishHost, settle } from '../../../game/tournament/bracketFixtures';
import type { TournamentSnapshot } from '../../../tournament/types';
import { useTournament } from '../../../tournament/useTournament';
import { isTouchDevice } from '../../fullscreen';
import { mounts, resetTiles } from './fakeMatchTile';
import { renderWatch, reportStatus, shownPeers } from './watchScreenTestKit';

vi.mock('./MatchTile', () => import('./fakeMatchTile').then(k => ({ MatchTile: k.FakeTile })));
vi.mock('../../../tournament/useTournament', () => ({ useTournament: vi.fn() }));
vi.mock('../../fullscreen', () => ({ isTouchDevice: vi.fn() }));

const feed = (snapshot: TournamentSnapshot) => vi.mocked(useTournament).mockReturnValue({ snapshot, error: null });
const oneLive = (peer = 'peer-0') => publishHost(makeSnapshot(4), 0, 0, peer);
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** The host leaves, then the 5 s retry remounts the tile. */
const failAndRetry = (peer: string) => { reportStatus(peer, 'host_left'); wait(5000); };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(isTouchDevice).mockReturnValue(false);
    resetTiles();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('WatchScreen retry of a tile whose host left', () => {
    it('remounts the tile 5 s after host_left while its match is still live', () => {
        feed(oneLive());
        renderWatch();
        reportStatus('peer-0', 'host_left');
        wait(4900);
        expect(mounts.get('peer-0')).toBe(1);
        wait(100);
        expect(mounts.get('peer-0')).toBe(2);
        expect(screen.queryByText('The host left')).not.toBeInTheDocument();
    });

    it('gives up after 3 tries and keeps showing that the host left', () => {
        feed(oneLive());
        renderWatch();
        for (let i = 0; i < 3; i++) failAndRetry('peer-0');
        expect(mounts.get('peer-0')).toBe(4);
        reportStatus('peer-0', 'host_left');
        wait(20_000);
        expect(mounts.get('peer-0')).toBe(4);
        expect(screen.getByText('The host left')).toBeInTheDocument();
    });

    it('a new peer id (host reloaded) starts a fresh count', () => {
        feed(oneLive());
        const view = renderWatch();
        for (let i = 0; i < 3; i++) failAndRetry('peer-0');
        feed(oneLive('peer-0b'));
        view.refresh();
        expect(shownPeers()).toEqual(['peer-0b']);
        for (let i = 0; i < 3; i++) failAndRetry('peer-0b');
        expect(mounts.get('peer-0b')).toBe(4);
    });

    it('does not retry once the match is no longer live', () => {
        feed(oneLive());
        const view = renderWatch();
        reportStatus('peer-0', 'host_left');
        wait(3000);
        feed(settle(oneLive(), 0, 0, 0, 10, 4));
        view.refresh();
        wait(10_000);
        expect(shownPeers()).toEqual([]);
        expect(mounts.get('peer-0')).toBe(1);
    });

    it('expanding restarts the wait, and a tile hidden behind the expanded one is not retried', () => {
        feed(publishHost(oneLive(), 0, 1, 'peer-1'));
        renderWatch();
        reportStatus('peer-0', 'host_left');
        reportStatus('peer-1', 'host_left');
        wait(3000);
        act(() => { screen.getByRole('button', { name: 'P2 vs P3' }).click(); });
        wait(3000); // 6 s after host_left, but only 3 s since the layout changed
        expect(mounts.get('peer-1')).toBe(1);
        wait(2000);
        expect(mounts.get('peer-1')).toBe(2);
        expect(mounts.get('peer-0')).toBe(1); // unmounted behind the expanded tile, no timer
    });
});
