import { describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COVER_SPECS, COVER_WARN_MS, Cover } from '../../cover/coverTypes';

// jsdom has no 2D canvas to bake the pictures: one fake texture per kind and stage
const baked = new Map<string, Texture>();
const bakes = vi.fn();
vi.mock('./coverTextures', () => ({
    coverResolution: () => 1,
    coverTexture: (kind: string, stage: number, res: number) => {
        bakes(kind, stage, res);
        const key = `${kind}:${stage}`;
        if (!baked.has(key)) baked.set(key, new Texture());
        return { texture: baked.get(key)!, anchorX: 0.5, anchorY: 0.8 };
    },
}));

const { CoverView } = await import('./coverView');

const piece = (id: string, kind: Cover['kind'], x: number, hp = COVER_SPECS[kind].hp, over: Partial<Cover> = {}): Cover =>
    ({ id, kind, pos: { x, y: 500 }, hp, ...over });

/** Every display object of the given class under `root`, depth first. */
const all = <T extends Container>(root: Container, type: new (...a: never[]) => T): T[] =>
    root.children.flatMap(c => [...(c instanceof type ? [c as T] : []), ...all(c as Container, type)]);

const setup = () => {
    const layer = new Container();
    const view = new CoverView(layer);
    return { layer, view, sprites: () => all(layer, Sprite), holos: () => all(layer, Graphics).filter(g => g.label === 'holo') };
};

describe('CoverView', () => {
    it('shows one sprite per cover', () => {
        const { view, sprites } = setup();
        view.sync([piece('a', 'wood', 100), piece('b', 'metal', 300), piece('c', 'glass', 500)], 0);
        expect(sprites()).toHaveLength(3);
        view.sync([piece('a', 'wood', 100), piece('c', 'glass', 500)], 16);
        expect(sprites()).toHaveLength(2);
    });

    it('puts each piece at its feet', () => {
        const { view, sprites } = setup();
        view.sync([piece('a', 'wood', 123)], 0);
        const root = sprites()[0].parent;
        expect(root.position.x).toBe(123);
        expect(root.position.y).toBe(500);
    });

    it('stays behind everything else in its layer', () => {
        const layer = new Container();
        const view = new CoverView(layer);
        const fighter = new Container();
        layer.addChild(fighter);
        view.sync([piece('a', 'wood', 100)], 0);
        expect(layer.children[0]).not.toBe(fighter);
        expect(layer.children.indexOf(fighter)).toBeGreaterThan(0);
    });

    it('swaps the texture when the stage changes', () => {
        const { view, sprites } = setup();
        const crate = piece('a', 'wood', 100);
        view.sync([crate], 0);
        const intact = sprites()[0].texture;
        crate.hp = 40; // under a third: stage 2
        view.sync([crate], 16);
        expect(sprites()[0].texture).not.toBe(intact);
        expect(bakes).toHaveBeenLastCalledWith('wood', 2, 1);
        crate.hp = 0; // destroyed: the remains
        view.sync([crate], 32);
        expect(bakes).toHaveBeenLastCalledWith('wood', 3, 1);
    });

    it('shows the hologram only in the last 2 s before the piece returns', () => {
        const { view, holos } = setup();
        const gone = piece('a', 'wood', 100, 0, { returnsAt: 100_000 });
        view.sync([gone], 100_000 - COVER_WARN_MS - 500);
        expect(holos()).toHaveLength(0);
        view.sync([gone], 100_000 - COVER_WARN_MS + 100);
        expect(holos()).toHaveLength(1);
        expect(holos()[0].context.instructions.length).toBeGreaterThan(0);
        view.sync([gone], 100_000 - 10);
        expect(holos()).toHaveLength(1);
    });

    it('keeps the hologram up when the clock is a little past returnsAt, and tolerates a start 33 ms early', () => {
        const { view, holos } = setup();
        const gone = piece('a', 'glass', 100, 0, { returnsAt: 50_000 });
        view.sync([gone], 50_040); // a blocked return waits for its retry
        expect(holos()).toHaveLength(1);
        view.sync([gone], 50_000 - COVER_WARN_MS - 33); // snapshot copy of returnsAt shifted by one tick
        expect(holos()).toHaveLength(0);
    });

    it('drops the hologram once the piece is solid again', () => {
        const { view, holos } = setup();
        const crate = piece('a', 'metal', 100, 0, { returnsAt: 10_000 });
        view.sync([crate], 9_000);
        expect(holos()).toHaveLength(1);
        crate.hp = COVER_SPECS.metal.hp;
        delete crate.returnsAt;
        view.sync([crate], 10_016);
        expect(holos()).toHaveLength(0);
    });

    it('draws the vent only on a barrel that is badly damaged', () => {
        const { view, layer } = setup();
        const vents = () => all(layer, Graphics).filter(g => g.label === 'vent');
        const barrel = piece('a', 'barrel', 100);
        view.sync([barrel], 0);
        expect(vents()).toHaveLength(0);
        barrel.hp = 20; // stage 2
        view.sync([barrel], 16);
        expect(vents()).toHaveLength(1);
        expect(vents()[0].context.instructions.length).toBeGreaterThan(0);
        barrel.hp = 0;
        view.sync([barrel], 32);
        expect(vents()).toHaveLength(0);
    });

    it('recovers when its baked pictures were freed under it', () => {
        const { view, sprites } = setup();
        view.sync([piece('a', 'wood', 100)], 0);
        const old = sprites()[0].texture;
        baked.clear();
        Object.assign(old, { destroyed: true });
        view.sync([piece('a', 'wood', 100)], 16);
        expect(sprites()[0].texture).not.toBe(old);
    });

    it('clear removes everything', () => {
        const { view, layer } = setup();
        view.sync([piece('a', 'wood', 100), piece('b', 'barrel', 200, 20)], 0);
        const root = layer.children[0];
        view.clear();
        expect(layer.children).toHaveLength(0);
        expect(root.destroyed).toBe(true);
    });
});
