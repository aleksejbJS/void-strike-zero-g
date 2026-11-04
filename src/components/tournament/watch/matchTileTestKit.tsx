// Test helpers for MatchTile: manual animation frames, a fake MatchView and the host's side
// of the fake link (fakePeerSocket.ts). Pair with the vi.mock calls in each MatchTile test file.

import React from 'react';
import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { snapshotOf, watchInfo } from '../../../game/net/spectatorTestKit';
import { MSG } from '../../../game/net/protocol';
import { Entity } from '../../../types';
import { MatchTile, TileStatus } from './MatchTile';
import { sockets } from './fakePeerSocket';

export const fakeView = () => ({ render: vi.fn(), setAdsEnabled: vi.fn(), destroy: vi.fn() });

let frames: FrameRequestCallback[] = [];

/** Replace requestAnimationFrame so a test decides when the tile draws. */
export const installFrames = () => {
    frames = [];
    sockets.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
};

/** Run the frames the tile asked for (each asks for the next one). */
export const step = () => act(() => { frames.splice(0).forEach(f => f(performance.now())); });

export const lastSocket = () => sockets[sockets.length - 1];

export const mountTile = (props: { audible?: boolean; expanded?: boolean } = {}) => {
    const onStatus = vi.fn<[TileStatus], void>();
    const onScore = vi.fn();
    const ui = (p: typeof props) => (
        <MatchTile peerId="host-1" audible={p.audible ?? false} expanded={p.expanded ?? false} onStatus={onStatus} onScore={onScore} />
    );
    const result = render(ui(props));
    const lastStatus = () => onStatus.mock.calls[onStatus.mock.calls.length - 1]?.[0];
    return { ...result, onStatus, onScore, lastStatus, rerenderWith: (p: typeof props) => result.rerender(ui(p)) };
};

/** The host accepts the spectator; `matchEndsAt` marks a match that is already over. */
export const hostAccepts = (players: Entity[] = [], matchEndsAt?: number) => act(() => {
    const socket = lastSocket();
    const info = watchInfo(players);
    socket.fire('connect');
    socket.fire(MSG.WATCHING, { ...info, snapshot: { ...info.snapshot, matchEndsAt } });
});

export const hostSends = (players: Entity[]) => act(() => { lastSocket().fire(MSG.SNAPSHOT, snapshotOf(players)); });

export const fire = (event: string, data?: unknown) => act(() => { lastSocket().fire(event, data); });
