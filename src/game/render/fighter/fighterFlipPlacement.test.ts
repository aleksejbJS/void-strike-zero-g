import { describe, it, expect, vi } from 'vitest';
import { Container, Point, Texture } from 'pixi.js';
import { createFighterView, FighterView } from './fighterView';
import { applyFlip, FLIP_CENTER_PX } from './fighterFlipPlacement';

// jsdom has no 2D canvas to bake the glow texture; placement maths does not depend on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

/** A view inside a parent at the fighter's feet, scaled like drawFighter does (mirrored when facing left). */
const setup = (facing: 1 | -1, squash = 0) => {
    const parent = new Container();
    const view = createFighterView();
    parent.addChild(view.root);
    view.root.scale.set(facing * 0.25 * (1 + 0.18 * squash), 0.25 * (1 - 0.16 * squash));
    view.weapon.position.set(30, -150);
    view.weapon.rotation = -0.4;
    return { parent, view };
};

const global = (view: FighterView, local: { x: number; y: number }, of: Container) => of.toGlobal(new Point(local.x, local.y));

describe('applyFlip', () => {
    for (const facing of [1, -1] as const) {
        it(`turns the fighter about its body centre, facing ${facing > 0 ? 'right' : 'left'}`, () => {
            const { view } = setup(facing);
            applyFlip(view, Math.PI / 2, 0);
            expect(view.root.rotation).toBeCloseTo(Math.PI / 2);
            // The body centre (36 px above the feet) stays put
            const centreLocal = { x: 0, y: -FLIP_CENTER_PX / view.root.scale.y };
            const c = global(view, centreLocal, view.root);
            expect(c.x).toBeCloseTo(0, 3);
            expect(c.y).toBeCloseTo(-FLIP_CENTER_PX, 3);
        });

        it(`keeps the gun where it is without a flip, facing ${facing > 0 ? 'right' : 'left'}`, () => {
            const still = setup(facing);
            applyFlip(still.view, 0, 0);
            const muzzleStill = global(still.view, { x: 100, y: 0 }, still.view.weapon);
            const tail = global(still.view, { x: 0, y: 0 }, still.view.weapon);

            const turning = setup(facing);
            applyFlip(turning.view, 2.1, 0);
            const muzzle = global(turning.view, { x: 100, y: 0 }, turning.view.weapon);
            const tailTurning = global(turning.view, { x: 0, y: 0 }, turning.view.weapon);
            expect(muzzle.x).toBeCloseTo(muzzleStill.x, 2);
            expect(muzzle.y).toBeCloseTo(muzzleStill.y, 2);
            expect(tailTurning.x).toBeCloseTo(tail.x, 2);
            expect(tailTurning.y).toBeCloseTo(tail.y, 2);
        });
    }

    it('keeps the gun in place under a landing squash too', () => {
        const still = setup(1, 0.5);
        applyFlip(still.view, 0, 0);
        const a = global(still.view, { x: 100, y: 0 }, still.view.weapon);
        const turning = setup(1, 0.5);
        applyFlip(turning.view, 1, 0);
        const b = global(turning.view, { x: 100, y: 0 }, turning.view.weapon);
        expect(b.x).toBeCloseTo(a.x, 2);
        expect(b.y).toBeCloseTo(a.y, 2);
    });

    it('without a flip the root sits at the feet, lifted by a hop, and is not turned', () => {
        const { view } = setup(1);
        applyFlip(view, 1, 0);
        applyFlip(view, 0, 4);
        expect(view.root.rotation).toBe(0);
        expect(view.root.position.x).toBe(0);
        expect(view.root.position.y).toBe(-4);
        expect(view.gunLayer.rotation).toBe(0);
        expect(view.gunLayer.position.x).toBe(0);
        expect(view.gunLayer.position.y).toBe(0);
    });
});
