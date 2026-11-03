import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { GameMode, Team } from '../../types';
import { HOP_PX } from './fighter/fighterMotion';
import { createPlayerVisual, forgetPlayerVisual, updatePlayerVisual } from './playerVisual';

// jsdom has no 2D canvas to bake the glow texture; the placement of the fighter does not depend on it
vi.mock('./effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

/** Draws one frame of a player standing on the ground at (100, 500), moving right at 1, and returns the pieces. */
const drawn = (id: string, wounded: boolean) => {
    const p = createMockPlayer(id, Team.BLUE);
    p.pos = { x: 100, y: 500 };
    p.isGrounded = true;
    p.vel.x = 1;
    if (wounded) p.wound = { by: 'x' };
    const c = createPlayerVisual(p);
    updatePlayerVisual(c, p, { x: 0, y: 0 }, { x: 0, y: 0 }, 800, 600, {}, false, createMockState(GameMode.DEATHMATCH), 1000);
    const parts = { container: c, root: c.children[1], shadow: c.getChildByLabel('contactShadow')! };
    return { ...parts, cleanup: () => { c.destroy({ children: true, context: true }); forgetPlayerVisual(id); } };
};

describe('a player on screen', () => {
    it('a one-legged fighter hops: the fighter rises, the contact shadow stays on the ground', () => {
        const { container, root, shadow, cleanup } = drawn('hopper', true);
        expect(container.position.y).toBe(500);
        expect(root.position.y).toBe(-HOP_PX);
        expect(shadow.position.y).toBe(0);
        cleanup();
    });

    it('a whole fighter stays at its feet', () => {
        const { root, cleanup } = drawn('runner', false);
        expect(root.position.y).toBe(0);
        cleanup();
    });
});
