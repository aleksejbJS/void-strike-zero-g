import { describe, expect, it, vi } from 'vitest';
import { destroyApp } from './pixiApp';

const fakeApp = () => ({ destroy: vi.fn() });

describe('destroyApp', () => {
    it('removes the canvas from the page without releasing the global Pixi pools', () => {
        const app = fakeApp();
        destroyApp(app);
        expect(app.destroy).toHaveBeenCalledTimes(1);
        const [renderer] = app.destroy.mock.calls[0];
        expect(renderer).toEqual({ removeView: true });
        expect(renderer).not.toBe(true);
    });

    it('drops the display tree but keeps the shared textures', () => {
        const app = fakeApp();
        destroyApp(app);
        const [, children] = app.destroy.mock.calls[0];
        expect(children).toEqual({ children: true, texture: false });
    });
});
