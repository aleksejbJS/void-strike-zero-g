import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { COVER_SPECS, Cover } from '../../cover/coverTypes';

// jsdom has no 2D canvas: the art is not drawn, only the textures made from the canvases are counted
vi.mock('../scene/canvasKit', async importOriginal => {
    const stubCtx = new Proxy({}, { get: () => () => undefined, set: () => true });
    return {
        ...(await importOriginal<typeof import('../scene/canvasKit')>()),
        makeCanvas: () => ({ canvas: { width: 8, height: 8 }, ctx: stubCtx }),
        overlayNoise: () => undefined,
    };
});
vi.mock('./woodArt', () => ({ drawWood: vi.fn() }));
vi.mock('./metalArt', () => ({ drawMetal: vi.fn() }));
vi.mock('./glassArt', () => ({ drawGlass: vi.fn() }));
vi.mock('./barrelArt', () => ({ drawBarrel: vi.fn(), barrelVent: vi.fn() }));

const made: Texture[] = [];
const { CoverView } = await import('./coverView');
const { coverTexture, destroyCoverTextures, releaseCoverTextures, retainCoverTextures } = await import('./coverTextures');

beforeEach(() => {
    destroyCoverTextures();
    made.length = 0;
    vi.spyOn(Texture, 'from').mockImplementation(() => {
        const t = new Texture();
        t.destroy = vi.fn();
        made.push(t);
        return t;
    });
});

const crate: Cover = { id: 'a', kind: 'wood', pos: { x: 100, y: 500 }, hp: COVER_SPECS.wood.hp };
const spriteOf = (layer: Container) => layer.children[0].children[0].children[0] as Sprite;

describe('coverTexture', () => {
    it('bakes each kind, stage and resolution once', () => {
        const first = coverTexture('wood', 0, 2);
        expect(coverTexture('wood', 0, 2)).toBe(first);
        coverTexture('wood', 1, 2);
        coverTexture('wood', 0, 1);
        expect(made).toHaveLength(3);
    });
});

describe('shared baked pictures', () => {
    it('stay alive while any view is, and are freed when the last one clears', () => {
        const layerA = new Container(), layerB = new Container();
        const a = new CoverView(layerA), b = new CoverView(layerB);
        a.sync([crate], 0);
        b.sync([crate], 0);
        expect(made).toHaveLength(4); // the crate's four stages, baked once for both views
        const picture = made[0];      // stage 0, baked first
        expect(spriteOf(layerA).texture).toBe(picture);

        a.clear();
        expect(picture.destroy).not.toHaveBeenCalled();
        b.sync([crate], 16);
        expect(spriteOf(layerB).texture).toBe(picture);

        b.clear();
        for (const t of made) expect(t.destroy).toHaveBeenCalledTimes(1);
        expect(picture.destroy).toHaveBeenCalledWith(true);
    });

    it('are baked afresh for a view made after the last one cleared', () => {
        const first = new CoverView(new Container());
        first.sync([crate], 0);
        first.clear();
        const layer = new Container();
        const second = new CoverView(layer);
        second.sync([crate], 0);
        expect(made).toHaveLength(8); // four stages each time
        expect(spriteOf(layer).texture).toBe(made[4]);
        second.clear();
    });

    it('count a view once however often it is cleared', () => {
        const a = new CoverView(new Container()), layerB = new Container(), b = new CoverView(layerB);
        b.sync([crate], 0);
        a.clear();
        a.clear(); // a second clear must not release b's share
        expect(made[0].destroy).not.toHaveBeenCalled();
        b.clear();
        expect(made[0].destroy).toHaveBeenCalledTimes(1);
    });

    it('never counts below zero', () => {
        releaseCoverTextures();
        retainCoverTextures();
        coverTexture('metal', 0, 1);
        expect(made[0].destroy).not.toHaveBeenCalled();
        releaseCoverTextures();
        expect(made[0].destroy).toHaveBeenCalledTimes(1);
    });
});
