import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMatchView } from '../../../game/render/matchView/matchView';
import { SpectatorSession } from '../../../game/net/spectatorSession';
import { playSound } from '../../../game/systems/audio';
import { MSG } from '../../../game/net/protocol';
import { at } from '../../../game/net/spectatorTestKit';
import { fakeView, fire, hostAccepts, installFrames, lastSocket, mountTile, step } from './matchTileTestKit';
import { WATCH_ANSWER_TIMEOUT_MS } from './MatchTile';

// Pixi needs WebGL and PeerJS needs a broker: the tile gets a fake view and a fake host link
vi.mock('../../../game/render/matchView/matchView', () => ({ createMatchView: vi.fn() }));
vi.mock('../../../game/net/peerSocket', async () => ({ PeerSocket: (await import('./fakePeerSocket')).FakePeerSocket }));
vi.mock('../../../game/systems/audio', async importOriginal => ({ ...(await importOriginal<object>()), playSound: vi.fn() }));

let view: ReturnType<typeof fakeView>;

beforeEach(() => {
    installFrames();
    view = fakeView();
    vi.mocked(createMatchView).mockReset().mockResolvedValue(view);
    vi.mocked(playSound).mockReset();
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('MatchTile status', () => {
    it('connects to the host peer and waits as connecting', () => {
        const { lastStatus } = mountTile();
        expect(lastSocket().peerId).toBe('host-1');
        expect(lastStatus()).toBe('connecting');
    });

    it('goes live once the host lets it watch', async () => {
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        expect(lastStatus()).toBe('live');
    });

    it('shows full when the match has no room for another spectator', async () => {
        const { lastStatus } = mountTile();
        await fire(MSG.JOIN_REJECTED, { reason: 'spectators_full' });
        expect(lastStatus()).toBe('full');
    });

    it('says the match ended when the link closes after the final whistle', async () => {
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)], Date.now() + 5000);
        await step();
        await fire('disconnect'); // must not throw
        expect(lastStatus()).toBe('ended');
    });

    it('says the host left when the link closes mid-match', async () => {
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        await step();
        await fire('disconnect'); // must not throw
        expect(lastStatus()).toBe('host_left');
    });

    it('closes the link as soon as it ends, and only once', async () => {
        const dispose = vi.spyOn(SpectatorSession.prototype, 'dispose');
        const { unmount } = mountTile();
        await hostAccepts();
        await fire('disconnect');
        expect(dispose).toHaveBeenCalledTimes(1);
        unmount();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('gives up as host_left when the host never answers', async () => {
        vi.useFakeTimers();
        const dispose = vi.spyOn(SpectatorSession.prototype, 'dispose');
        const { lastStatus } = mountTile();
        await act(async () => { vi.advanceTimersByTime(WATCH_ANSWER_TIMEOUT_MS - 1); });
        expect(lastStatus()).toBe('connecting');
        await act(async () => { vi.advanceTimersByTime(1); });
        expect(lastStatus()).toBe('host_left');
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('waits 30 s for an answer from a slow broker', () => {
        expect(WATCH_ANSWER_TIMEOUT_MS).toBe(30_000);
    });
});

describe('MatchTile teardown and sound', () => {
    it('destroys the view and closes the session exactly once on unmount', async () => {
        const dispose = vi.spyOn(SpectatorSession.prototype, 'dispose');
        const { unmount } = mountTile();
        await act(async () => {}); // the view is ready
        unmount();
        expect(view.destroy).toHaveBeenCalledTimes(1);
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('destroys a view that was still starting when the tile went away', async () => {
        let ready!: (v: typeof view) => void;
        vi.mocked(createMatchView).mockReturnValue(new Promise(resolve => { ready = resolve; }));
        const { unmount } = mountTile();
        unmount();
        await act(async () => { ready(view); });
        expect(view.destroy).toHaveBeenCalledTimes(1);
        expect(view.render).not.toHaveBeenCalled();
    });

    it('never plays a sound while not audible', async () => {
        const { rerenderWith } = mountTile({ audible: false });
        await hostAccepts();
        await fire(MSG.EVENTS, [{ type: 'SOUND', sound: 'shoot', subtype: 'rocket' }]);
        expect(playSound).not.toHaveBeenCalled();

        rerenderWith({ audible: true });
        await fire(MSG.EVENTS, [{ type: 'SOUND', sound: 'shoot', subtype: 'rocket' }]);
        expect(playSound).toHaveBeenCalledTimes(1);
        expect(playSound).toHaveBeenCalledWith('shoot', 'rocket');
    });
});
