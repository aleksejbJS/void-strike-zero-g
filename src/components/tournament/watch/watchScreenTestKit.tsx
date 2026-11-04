// Test helpers for WatchScreen: a store spy, a renderer and queries over the fake tiles (fakeMatchTile.tsx).
// Pair with the vi.mock calls in each WatchScreen test file.

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../../store/uiStore';
import type { TileStatus } from './MatchTile';
import { tiles } from './fakeMatchTile';
import { WatchScreen } from './WatchScreen';

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
export const uiStore = () => store;

export const renderWatch = (id = 't1') => {
    const tree = () => <UIProvider><Spy /><WatchScreen id={id} /></UIProvider>;
    const result = render(tree());
    return { ...result, refresh: () => result.rerender(tree()) };
};

/** Peer ids of the tiles on screen, in order. */
export const shownPeers = () => screen.queryAllByTestId('tile').map(t => t.getAttribute('data-peer'));
export const audiblePeers = () => screen.queryAllByTestId('tile').filter(t => t.dataset.audible === 'true').map(t => t.dataset.peer);

/** Report a live score from a tile, as MatchTile.onScore does. */
export const reportScore = (peerId: string, players: { name: string; score: number }[]) =>
    act(() => { tiles.get(peerId)?.onScore?.(players); });

/** Report a tile status, as MatchTile.onStatus does. */
export const reportStatus = (peerId: string, status: TileStatus) =>
    act(() => { tiles.get(peerId)?.onStatus?.(status); });
