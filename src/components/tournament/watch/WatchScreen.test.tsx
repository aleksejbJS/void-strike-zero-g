import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { makeSnapshot, publishHost, settle } from '../../../game/tournament/bracketFixtures';
import type { TournamentSnapshot } from '../../../tournament/types';
import { useTournament } from '../../../tournament/useTournament';
import { isTouchDevice } from '../../fullscreen';
import { mounts, resetTiles } from './fakeMatchTile';
import { audiblePeers, renderWatch, shownPeers, uiStore } from './watchScreenTestKit';

vi.mock('./MatchTile', () => import('./fakeMatchTile').then(k => ({ MatchTile: k.FakeTile })));
vi.mock('../../../tournament/useTournament', () => ({ useTournament: vi.fn() }));
vi.mock('../../fullscreen', () => ({ isTouchDevice: vi.fn() }));

const feed = (snapshot: TournamentSnapshot) => vi.mocked(useTournament).mockReturnValue({ snapshot, error: null });
const threeLive = () => {
    let s = makeSnapshot(8);
    for (const slot of [0, 1, 2]) s = publishHost(s, 0, slot, `peer-${slot}`);
    return s;
};
const tileButton = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(isTouchDevice).mockReturnValue(false);
    resetTiles();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('WatchScreen', () => {
    it('shows every live match and exactly one of them is audible', () => {
        feed(threeLive());
        renderWatch();
        expect(shownPeers()).toEqual(['peer-0', 'peer-1', 'peer-2']);
        expect(audiblePeers()).toEqual(['peer-0']);
    });

    it('clicking a tile expands it and makes it audible; the others unmount; Esc restores the grid', () => {
        feed(threeLive());
        renderWatch();
        fireEvent.click(tileButton('P2 vs P3'));
        expect(shownPeers()).toEqual(['peer-1']);
        expect(screen.getByTestId('tile').dataset).toMatchObject({ expanded: 'true', audible: 'true' });
        expect(mounts.get('peer-1')).toBe(1); // the expanded tile keeps its link and view

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(shownPeers()).toEqual(['peer-0', 'peer-1', 'peer-2']);
        expect(audiblePeers()).toEqual(['peer-1']); // the last one clicked
        expect(screen.getAllByTestId('tile').every(t => t.dataset.expanded === 'false')).toBe(true);
    });

    it('a second click on the expanded tile returns to the grid', () => {
        feed(threeLive());
        renderWatch();
        fireEvent.click(tileButton('P4 vs P5'));
        fireEvent.click(tileButton('P4 vs P5'));
        expect(shownPeers()).toHaveLength(3);
        expect(audiblePeers()).toEqual(['peer-2']);
    });

    it('the global mute silences every tile', () => {
        feed(threeLive());
        renderWatch();
        act(() => uiStore().actions.toggleMute());
        expect(audiblePeers()).toEqual([]);
    });

    it('a finished match is replaced with the next live one when the snapshot updates', () => {
        let s = makeSnapshot(8);
        for (const slot of [0, 1, 2, 3]) s = publishHost(s, 0, slot, `peer-${slot}`);
        feed(s);
        const view = renderWatch();
        s = settle(settle(s, 0, 0, 0, 10, 2), 0, 1, 2, 10, 5);
        s = publishHost(s, 1, 0, 'peer-sf');
        feed(s);
        view.refresh();
        expect(shownPeers()).toEqual(['peer-2', 'peer-3', 'peer-sf']);
    });

    it('says so when no match is live', () => {
        feed(makeSnapshot(8));
        renderWatch();
        expect(shownPeers()).toEqual([]);
        expect(screen.getByText('No match is live right now.')).toBeInTheDocument();
    });

    it('Back returns to the bracket', () => {
        feed(threeLive());
        renderWatch('t1');
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(uiStore().state.tournamentNav).toEqual({ view: 'tournament', id: 't1' });
    });

    it('on a phone it shows one tile and a swipe of more than 60 px moves to the next match', () => {
        vi.mocked(isTouchDevice).mockReturnValue(true);
        vi.stubGlobal('innerHeight', 400);
        feed(threeLive());
        renderWatch();
        expect(shownPeers()).toEqual(['peer-0']);
        const area = screen.getByTestId('watch-tiles');
        const swipe = (from: number, to: number) => {
            fireEvent.touchStart(area, { touches: [{ clientX: from, clientY: 100 }] });
            fireEvent.touchEnd(area, { changedTouches: [{ clientX: to, clientY: 100 }] });
        };
        swipe(300, 250); // too short
        expect(shownPeers()).toEqual(['peer-0']);
        swipe(300, 200);
        expect(shownPeers()).toEqual(['peer-1']);
        expect(audiblePeers()).toEqual(['peer-1']);
        swipe(200, 300);
        expect(shownPeers()).toEqual(['peer-0']);
    });
});
