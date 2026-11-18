import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container, Graphics, Shader, Text, type Mesh } from 'pixi.js';
import { BeamView } from '../projectiles/beamView';
import { ProjectileView } from '../projectiles/projectileView';
import { SmokeView } from './smokeView';

const cloud = { id: 'smoke_1', pos: { x: 0, y: 0 }, radius: 110, bornAt: 0, endsAt: 10_000 };
const gfxOf = (view: SmokeView) => (view as unknown as { gfx: Graphics }).gfx;
const drawnOf = (view: SmokeView) => gfxOf(view).context.instructions.length;
const silhouette = { x: 0, y: 40, w: 20, h: 52 };

/** The children of the cloud layer, which sits right under the outline. */
const quadsUnder = (layer: Container) => (layer.children[layer.children.length - 2] as Container).children;

// One frame in renderer order: projectiles, (floating text added), beams, smoke last
const frame = (layer: Container, views: { proj: ProjectileView; beam: BeamView; smoke: SmokeView }, addText: boolean) => {
    views.proj.sync([], 1000);
    if (addText) layer.addChild(new Text({ text: '-25' }));
    views.beam.sync([]);
    views.smoke.sync([cloud], 1000, null);
};

describe('SmokeView', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const spies: { mockRestore: () => void }[] = [];
    const made: SmokeView[] = [];
    const makeView = (layer: Container) => { const v = new SmokeView(layer); made.push(v); return v; };
    afterEach(() => {
        for (const v of made.splice(0)) v.clear();
        for (const s of spies.splice(0)) s.mockRestore();
    });

    it('stays the topmost child even after a floating text reshuffles the other effect views', () => {
        const layer = new Container();
        const views = { proj: new ProjectileView(layer), beam: new BeamView(layer), smoke: makeView(layer) };
        frame(layer, views, true);  // a damage number appears mid-frame
        frame(layer, views, false); // next frame the projectile view lifts itself over the text
        frame(layer, views, false);
        const top = layer.children[layer.children.length - 1];
        expect(top).toBe(gfxOf(views.smoke));
        views.smoke.clear();
        expect(layer.children).not.toContain(gfxOf(views.smoke));
    });

    it('the outline stays above the clouds', () => {
        const layer = new Container();
        const smoke = makeView(layer);
        smoke.sync([cloud], 1000, silhouette);
        const kids = layer.children;
        expect(kids[kids.length - 1]).toBe(gfxOf(smoke));
        expect(kids[kids.length - 2]).not.toBe(gfxOf(smoke));
        expect(quadsUnder(layer).length).toBe(1);                     // the cloud layer: one quad for the one cloud
        expect(drawnOf(smoke)).toBeGreaterThan(0);                    // the outline
    });

    it('keeps the clouds and the outline on top when other effect views are raised above them', () => {
        const layer = new Container();
        const proj = new ProjectileView(layer), smoke = makeView(layer);
        smoke.sync([cloud], 1000, silhouette);
        layer.addChild(new Text({ text: '-25' }));
        proj.sync([], 1000);
        smoke.sync([cloud], 1017, silhouette);
        expect(layer.children[layer.children.length - 1]).toBe(gfxOf(smoke));
        expect(quadsUnder(layer).length).toBe(1);
    });

    it('keeps the same quad when the smokes array is replaced by new objects with the same ids', () => {
        const layer = new Container();
        const smoke = makeView(layer);
        smoke.sync([cloud], 1000, null);
        const mesh = quadsUnder(layer)[0];
        smoke.sync([{ ...cloud, pos: { ...cloud.pos } }], 1017, null);       // what an online snapshot does every tick
        smoke.sync([{ ...cloud, pos: { ...cloud.pos } }], 1033, null);
        expect(quadsUnder(layer).length).toBe(1);
        expect(quadsUnder(layer)[0]).toBe(mesh);
        expect(mesh.destroyed).toBe(false);
    });

    it('draws no circles while the shader clouds work, and no outline without a silhouette', () => {
        const layer = new Container();
        const smoke = makeView(layer);
        smoke.sync([cloud], 1000, null);
        expect(drawnOf(smoke)).toBe(0);
    });

    it('frees the clouds when the view is cleared, and ignores a sync after that', () => {
        const layer = new Container();
        const smoke = makeView(layer);
        smoke.sync([cloud], 1000, null);
        const mesh = quadsUnder(layer)[0];
        smoke.clear();
        expect(mesh.destroyed).toBe(true);
        expect(layer.children.length).toBe(0);
        expect(() => smoke.sync([cloud], 1017, silhouette)).not.toThrow();
        expect(layer.children.length).toBe(0);
        expect(() => smoke.clear()).not.toThrow();
    });

    it('clear works after the stage was destroyed first, as the game screen does, and frees what the stage left', () => {
        const stage = new Container(), layer = new Container();
        stage.addChild(layer);
        const smoke = makeView(layer);
        smoke.sync([cloud, { ...cloud, id: 'smoke_2' }], 1000, silhouette);
        const meshes = quadsUnder(layer) as Mesh[];
        const shaders = meshes.map(m => m.shader!), geometries = meshes.map(m => m.geometry);
        const context = gfxOf(smoke).context;
        stage.destroy({ children: true, texture: false });         // destroyApp runs before smokeView.clear()
        expect(() => smoke.clear()).not.toThrow();
        for (const shader of shaders) expect(shader._destroyed).toBe(true);
        for (const geometry of geometries) expect(geometry.attributes).toBeNull();
        expect(context.instructions).toBeNull();                    // the Graphics context is freed too
        expect(() => smoke.clear()).not.toThrow();
        expect(() => smoke.sync([cloud], 1017, silhouette)).not.toThrow();
    });

    it('clear works after the stage was destroyed while the circles were drawn (shader had failed)', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const from = vi.spyOn(Shader, 'from').mockImplementation(() => { throw new Error('no WebGL'); });
        spies.push(from);
        const stage = new Container(), layer = new Container();
        stage.addChild(layer);
        const smoke = makeView(layer);
        smoke.sync([cloud], 1000, silhouette);
        stage.destroy({ children: true, texture: false });
        expect(() => smoke.clear()).not.toThrow();
    });

    describe('when the shader fails', () => {
        const breakShader = () => {
            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            const from = vi.spyOn(Shader, 'from').mockImplementation(() => { throw new Error('no WebGL'); });
            spies.push(error, from);
            return { error, from };
        };

        it('falls back to circles, logging once over two frames', () => {
            const { error, from } = breakShader();
            const smoke = makeView(new Container());
            smoke.sync([cloud], 1000, null);
            smoke.sync([cloud], 1017, null);
            expect(error).toHaveBeenCalledTimes(1);
            expect(error.mock.calls[0][0]).toBe('Smoke shader failed, drawing simple clouds:');
            expect(error.mock.calls[0][1]).toBeInstanceOf(Error);
            expect(from).toHaveBeenCalledTimes(1);                       // not retried every frame
            expect(drawnOf(smoke)).toBeGreaterThan(0);                   // the grey circles
        });

        it('frees the cloud layer and keeps the outline on top of the circles', () => {
            breakShader();
            const layer = new Container();
            const smoke = makeView(layer);
            smoke.sync([cloud], 1000, silhouette);
            smoke.sync([cloud], 1017, silhouette);
            expect(layer.children).toEqual([gfxOf(smoke)]);              // the empty cloud layer is gone
            const one = drawnOf(smoke);
            smoke.sync([cloud, { ...cloud, id: 'smoke_2' }], 1033, silhouette);
            expect(drawnOf(smoke)).toBeGreaterThan(one);                 // a second cloud, as circles
        });

        it('clears the circles when the clouds are gone', () => {
            breakShader();
            const smoke = makeView(new Container());
            smoke.sync([cloud], 1000, null);
            smoke.sync([], 1017, null);
            expect(drawnOf(smoke)).toBe(0);
        });
    });
});
