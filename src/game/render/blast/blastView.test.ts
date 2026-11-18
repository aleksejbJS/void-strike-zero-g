import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { Container } from 'pixi.js';
import { SolidTracker } from '../smoke/solidTracker';
import { BlastCloud } from './blastCloud';
import { BlastView } from './blastView';
import { frame, ring } from './blast.testkit';

// The flame textures are drawn on canvases, which jsdom does not have: stand-ins (or a failure, when asked)
const tex = vi.hoisted(() => ({ made: null as null | Record<string, unknown>, fail: false }));
vi.mock('../flame/flameTextures', async () => {
    const { Texture: T } = await import('pixi.js');
    return {
        flameTextures: () => {
            if (tex.fail) throw new Error('no canvas');
            return (tex.made ??= Object.fromEntries(['flame', 'smoke', 'core', 'ember', 'glow', 'pool', 'tongue'].map(k => [k, new T({})])));
        },
    };
});

// Pixi probes a 2D canvas when it builds a shader; jsdom has none
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { tex.fail = false; vi.restoreAllMocks(); });

describe('BlastView', () => {
    it('is made only once there is something to draw', () => {
        const view = new BlastView();
        expect(view.sync(1000, frame({}), [], true)).toBe(false);
        expect(view.layer).toBeNull();
        expect(view.sync(1016, frame({ particles: [ring('a')] }), [], true)).toBe(true);
        expect(view.layer).not.toBeNull();
        expect(view.hasGrids).toBe(true);
        expect(view.sync(1032, frame({ particles: [ring('a')] }), [], true)).toBe(false);
        view.destroy();
    });

    it('a failing grid logs once, frees the grids, and later blasts get simple puffs', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(BlastCloud.prototype, 'advance').mockImplementation(() => { throw new Error('gpu'); });
        const view = new BlastView();
        view.sync(1000, frame({ particles: [ring('a')] }), [], true);
        view.sync(1016, frame({ particles: [ring('a')] }), [], true);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.hasGrids).toBe(false);
        view.sync(1032, frame({ particles: [ring('b')] }), [], true);
        expect(view.hasGrids).toBe(false);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.layer).not.toBeNull();
        view.destroy();
    });

    it('the shader lost while a grid lives: the grid goes quietly, later blasts get puffs, nothing is logged', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const view = new BlastView();
        view.sync(1000, frame({ particles: [ring('a')] }), [], true);
        expect(view.hasGrids).toBe(true);
        view.sync(1016, frame({ particles: [ring('a')] }), [], false);
        view.sync(1032, frame({ particles: [ring('b')] }), [], false);
        expect(view.hasGrids).toBe(false);
        expect(view.layer).not.toBeNull();
        expect(error).not.toHaveBeenCalled();
        view.destroy();
    });

    it('low quality makes no grids', () => {
        const view = new BlastView();
        view.sync(1000, frame({ particles: [ring('a')] }, 'low'), [], true);
        expect(view.hasGrids).toBe(false);
        expect(view.layer).not.toBeNull();
        view.destroy();
    });

    it('a grid that fails while being made does not draw its blast twice', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(SolidTracker.prototype, 'refresh').mockImplementationOnce(() => { throw new Error('gpu'); });
        const view = new BlastView(), f = frame({ particles: [ring('a')] });
        view.sync(1000, f, [], true);
        view.sync(1016, f, [], true);
        const flash = (view.layer!.children[4] as Container).children.filter(k => k.visible).length;
        expect(flash).toBe(1);
        expect(error).toHaveBeenCalledTimes(1);
        view.destroy();
    });

    it('a failure of the blasts themselves logs once and draws no blasts from then on', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        tex.fail = true;
        const view = new BlastView();
        expect(view.sync(1000, frame({ particles: [ring('a')] }), [], true)).toBe(false);
        tex.fail = false;
        view.sync(1016, frame({ particles: [ring('b')] }), [], true);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.layer).toBeNull();
    });
});
