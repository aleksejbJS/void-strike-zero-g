import { afterEach, describe, expect, it, vi } from 'vitest';
import { enterFullscreen, exitFullscreen } from './fullscreen';

const setFullscreenApi = (enabled: boolean, element: Element | null) => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element });
};

describe('full screen', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('asks the browser to go full screen and hide its bar', async () => {
        setFullscreenApi(true, null);
        const request = vi.fn().mockResolvedValue(undefined);
        document.documentElement.requestFullscreen = request;
        await enterFullscreen();
        expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    });

    it('does nothing where full screen is not allowed (iPhone)', async () => {
        setFullscreenApi(false, null);
        const request = vi.fn();
        document.documentElement.requestFullscreen = request;
        await enterFullscreen();
        expect(request).not.toHaveBeenCalled();
    });

    it('reports a refused request instead of throwing', async () => {
        setFullscreenApi(true, null);
        document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('no gesture'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await enterFullscreen();
        expect(warn).toHaveBeenCalledWith('Could not enter full screen:', expect.any(Error));
    });

    it('leaves full screen only when in it', async () => {
        const exit = vi.fn().mockResolvedValue(undefined);
        document.exitFullscreen = exit;
        setFullscreenApi(true, null);
        await exitFullscreen();
        expect(exit).not.toHaveBeenCalled();
        setFullscreenApi(true, document.documentElement);
        await exitFullscreen();
        expect(exit).toHaveBeenCalledOnce();
    });
});
