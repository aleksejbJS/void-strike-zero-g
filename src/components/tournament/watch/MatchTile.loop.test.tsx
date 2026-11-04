import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMatchView } from '../../../game/render/matchView/matchView';
import { at } from '../../../game/net/spectatorTestKit';
import { fakeView, hostAccepts, hostSends, installFrames, mountTile, step } from './matchTileTestKit';

// Pixi needs WebGL and PeerJS needs a broker: the tile gets a fake view and a fake host link
vi.mock('../../../game/render/matchView/matchView', () => ({ createMatchView: vi.fn() }));
vi.mock('../../../game/net/peerSocket', async () => ({ PeerSocket: (await import('./fakePeerSocket')).FakePeerSocket }));

let view: ReturnType<typeof fakeView>;

beforeEach(() => {
    installFrames();
    view = fakeView();
    vi.mocked(createMatchView).mockReset().mockResolvedValue(view);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const ready = () => act(async () => {});

describe('MatchTile frame loop', () => {
    it('draws the watched world into its own view every frame', async () => {
        mountTile();
        await ready();
        await hostAccepts([at('a', 100)]);
        await step();
        expect(view.render).toHaveBeenCalledTimes(1);
        const [state] = view.render.mock.calls[0];
        expect(state.players.map((p: { id: string }) => p.id)).toEqual(['a']);
        await step();
        expect(view.render).toHaveBeenCalledTimes(2);
    });

    it('reports the score only when it changes', async () => {
        const { onScore } = mountTile();
        await ready();
        await hostAccepts([at('a', 0, 1), at('b', 0, 0)]);
        await step();
        expect(onScore).toHaveBeenCalledTimes(1);
        expect(onScore).toHaveBeenLastCalledWith([{ name: 'a', score: 1 }, { name: 'b', score: 0 }]);

        await hostSends([at('a', 50, 1), at('b', 60, 0)]); // they moved, nobody scored
        await step();
        expect(onScore).toHaveBeenCalledTimes(1);

        await hostSends([at('a', 50, 1), at('b', 60, 1)]);
        await step();
        expect(onScore).toHaveBeenCalledTimes(2);
        expect(onScore).toHaveBeenLastCalledWith([{ name: 'a', score: 1 }, { name: 'b', score: 1 }]);
    });
});

describe('MatchTile ads', () => {
    it('shows ads only while expanded', async () => {
        const { rerenderWith } = mountTile({ expanded: false });
        await ready();
        expect(view.setAdsEnabled).toHaveBeenLastCalledWith(false);

        rerenderWith({ expanded: true });
        expect(view.setAdsEnabled).toHaveBeenLastCalledWith(true);

        rerenderWith({ expanded: false });
        expect(view.setAdsEnabled).toHaveBeenLastCalledWith(false);
    });

    it('starts with ads on when the tile is already expanded', async () => {
        mountTile({ expanded: true });
        await ready();
        expect(view.setAdsEnabled).toHaveBeenCalledWith(true);
        expect(view.setAdsEnabled).not.toHaveBeenCalledWith(false);
    });
});
