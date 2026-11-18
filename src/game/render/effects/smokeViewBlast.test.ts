import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import type { Particle } from '../../../types';
import { cloud as makeCloud, frameOf, stateOf, VIEW } from '../smoke/cloudField.testkit';
import { SmokeStirs } from '../smoke/smokeStirs';
import { SmokeView } from './smokeView';

// The flame textures are drawn on canvases, which jsdom does not have: stand-ins
vi.mock('../flame/flameTextures', async () => {
    const { Texture: T } = await import('pixi.js');
    const made = Object.fromEntries(['flame', 'smoke', 'core', 'ember', 'glow', 'pool', 'tongue'].map(k => [k, new T({})]));
    return { flameTextures: () => made };
});

const T0 = 5000;
const FRAME = 1000 / 60;
const ring: Particle = { id: 'r1', pos: { x: 800, y: 450 }, vel: { x: 0, y: 0 }, life: 1, decay: 0.017, color: '#fff', size: 12, type: 'ring' };
const blastOf = (view: SmokeView) => (view as unknown as { blasts: { layer: Container | null } }).blasts.layer;
const fieldOf = (view: SmokeView) => (view as unknown as { field: { layer: Container } | null }).field;

describe('SmokeView blasts', () => {
    beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('draws a blast under the smoke clouds, and frees it with the view', () => {
        const layer = new Container(), view = new SmokeView(layer);
        const frame = frameOf(stateOf({ particles: [ring] }), VIEW, 'high');
        view.sync([makeCloud('a', 800, 450)], T0, null, frame);
        view.sync([makeCloud('a', 800, 450)], T0 + FRAME, null, frame);
        const blast = blastOf(view)!, clouds = fieldOf(view)!.layer;
        expect(blast).not.toBeNull();
        expect(layer.getChildIndex(blast)).toBeLessThan(layer.getChildIndex(clouds));
        view.clear();
        expect(blast.destroyed).toBe(true);
    });

    it('collects the stirs while a blast grid lives, with no smoke cloud', () => {
        const view = new SmokeView(new Container()), collect = vi.spyOn(SmokeStirs.prototype, 'collect');
        const frame = frameOf(stateOf({ particles: [ring] }), VIEW, 'high');
        view.sync([], T0, null, frame);
        view.sync([], T0 + FRAME, null, frame);
        expect(collect).toHaveBeenCalled();
        view.clear();
    });
});
