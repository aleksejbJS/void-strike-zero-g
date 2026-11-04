import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { makeSnapshot, publishHost, settle } from '../../../game/tournament/bracketFixtures';
import type { TournamentSnapshot } from '../../../tournament/types';
import { useTournament } from '../../../tournament/useTournament';
import { isTouchDevice } from '../../fullscreen';
import { resetTiles } from './fakeMatchTile';
import { renderWatch, reportScore, shownPeers } from './watchScreenTestKit';

vi.mock('./MatchTile', () => import('./fakeMatchTile').then(k => ({ MatchTile: k.FakeTile })));
vi.mock('../../../tournament/useTournament', () => ({ useTournament: vi.fn() }));
vi.mock('../../fullscreen', () => ({ isTouchDevice: vi.fn() }));

const feed = (snapshot: TournamentSnapshot) => vi.mocked(useTournament).mockReturnValue({ snapshot, error: null });
const stripMatch = (name: string) => screen.getByRole('listitem', { name });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(isTouchDevice).mockReturnValue(false);
    resetTiles();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('WatchScreen strip', () => {
    const twoLive = () => publishHost(publishHost(makeSnapshot(4), 0, 0, 'peer-0'), 0, 1, 'peer-1');

    it('shows the live score of a watched match, matched to the seats by name', () => {
        feed(twoLive());
        renderWatch();
        reportScore('peer-0', [{ name: 'P1', score: 4 }, { name: 'P0', score: 7 }]);
        expect(within(stripMatch('P0 vs P1')).getByText('7:4')).toBeInTheDocument();
    });

    it('unticking a match stops watching it: its tile goes and the strip shows LIVE only', () => {
        feed(twoLive());
        renderWatch();
        reportScore('peer-1', [{ name: 'P2', score: 1 }, { name: 'P3', score: 2 }]);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Watch P2 vs P3' }));
        expect(shownPeers()).toEqual(['peer-0']);
        const cell = stripMatch('P2 vs P3');
        expect(within(cell).getByText('LIVE')).toBeInTheDocument();
        expect(within(cell).queryByText('1:2')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Watch P2 vs P3' }));
        expect(shownPeers()).toEqual(['peer-0', 'peer-1']);
    });

    it('shows the final score of a decided match and no checkbox for it', () => {
        feed(publishHost(settle(makeSnapshot(4), 0, 0, 0, 10, 6), 0, 1, 'peer-1'));
        renderWatch();
        const done = stripMatch('P0 vs P1');
        expect(within(done).getByText('10:6')).toBeInTheDocument();
        expect(within(done).queryByRole('checkbox')).not.toBeInTheDocument();
    });
});
