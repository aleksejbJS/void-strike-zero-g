// Shared helpers for the useRangeRoute unit tests: plain mock actions and a mount helper.

import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GameMode, MapId } from '../../types';
import { useRangeRoute } from './useRangeRoute';

export const makeActions = () => ({
    startGame: vi.fn(), setNetworkState: vi.fn(), selectMode: vi.fn(), selectMap: vi.fn(), finishGame: vi.fn(),
});

export interface Props { hash: string; isPlaying: boolean; selectedMode: GameMode; selectedMap: MapId }

export const mountRoute = (
    hash: string, isPlaying = false, selectedMode = GameMode.GUN_GAME, selectedMap = MapId.DEFAULT, options: { strict?: boolean } = {},
) => {
    const actions = makeActions();
    const view = renderHook((p: Props) => useRangeRoute(p.hash, p.isPlaying, p.selectedMode, p.selectedMap, actions), {
        initialProps: { hash, isPlaying, selectedMode, selectedMap },
        reactStrictMode: options.strict,
    });
    return { actions, ...view };
};

// What the store does once the range starts: the match is up and the selected mode is RANGE
export const inRange: Props = { hash: '#range', isPlaying: true, selectedMode: GameMode.RANGE, selectedMap: MapId.DEFAULT };
export const afterEsc: Props = { ...inRange, isPlaying: false };
