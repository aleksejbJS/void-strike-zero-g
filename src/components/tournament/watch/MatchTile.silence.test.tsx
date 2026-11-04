import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMatchView } from '../../../game/render/matchView/matchView';
import { SpectatorSession } from '../../../game/net/spectatorSession';
import { at } from '../../../game/net/spectatorTestKit';
import { fakeView, fire, hostAccepts, hostSends, installFrames, mountTile } from './matchTileTestKit';
import { WATCH_SILENCE_TIMEOUT_MS } from './MatchTile';

// Pixi needs WebGL and PeerJS needs a broker: the tile gets a fake view and a fake host link
vi.mock('../../../game/render/matchView/matchView', () => ({ createMatchView: vi.fn() }));
vi.mock('../../../game/net/peerSocket', async () => ({ PeerSocket: (await import('./fakePeerSocket')).FakePeerSocket }));

beforeEach(() => {
    installFrames();
    vi.mocked(createMatchView).mockReset().mockResolvedValue(fakeView());
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const wait = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

// PeerJS may never report a host tab that closed: a host that goes quiet is gone
describe('MatchTile when the host goes quiet', () => {
    it('gives the host 5 s of silence before calling it gone', () => {
        expect(WATCH_SILENCE_TIMEOUT_MS).toBe(5_000);
    });

    it('says host_left after 5 s without a snapshot, and closes the link once', async () => {
        vi.useFakeTimers();
        const dispose = vi.spyOn(SpectatorSession.prototype, 'dispose');
        const { lastStatus, unmount } = mountTile();
        await hostAccepts([at('a', 100)]);
        await wait(WATCH_SILENCE_TIMEOUT_MS - 1);
        expect(lastStatus()).toBe('live');
        await wait(1);
        expect(lastStatus()).toBe('host_left');
        expect(dispose).toHaveBeenCalledTimes(1);
        unmount();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('says ended when the last snapshot showed the match over', async () => {
        vi.useFakeTimers();
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        await hostSends([at('a', 100)], Date.now() + 5000);
        await wait(WATCH_SILENCE_TIMEOUT_MS);
        expect(lastStatus()).toBe('ended');
    });

    it('restarts the countdown with every fresh snapshot', async () => {
        vi.useFakeTimers();
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        await wait(WATCH_SILENCE_TIMEOUT_MS - 1000);
        await hostSends([at('a', 120)]);
        await wait(WATCH_SILENCE_TIMEOUT_MS - 1);
        expect(lastStatus()).toBe('live');
        await wait(1);
        expect(lastStatus()).toBe('host_left');
    });

    it('stops counting once the link has ended on its own', async () => {
        vi.useFakeTimers();
        const dispose = vi.spyOn(SpectatorSession.prototype, 'dispose');
        const { onStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        await fire('disconnect');
        await wait(WATCH_SILENCE_TIMEOUT_MS * 2);
        expect(onStatus.mock.calls.map(c => c[0])).toEqual(['connecting', 'live', 'host_left']);
        expect(dispose).toHaveBeenCalledTimes(1);
    });
});

describe('MatchTile ended vs host_left', () => {
    it('trusts the last snapshot received, even one never drawn', async () => {
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)]);
        await hostSends([at('a', 100)], Date.now() + 5000); // arrives, then the host closes before the next frame
        await fire('disconnect');
        expect(lastStatus()).toBe('ended');
    });

    it('forgets a finished match once a newer snapshot says it is running again', async () => {
        const { lastStatus } = mountTile();
        await hostAccepts([at('a', 100)], Date.now() + 5000);
        await hostSends([at('a', 100)]);
        await fire('disconnect');
        expect(lastStatus()).toBe('host_left');
    });
});
