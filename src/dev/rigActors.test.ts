import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Container, Texture } from 'pixi.js';
import { loadBodyTextures, resetBodyTextures } from '../game/render/characters/textures';
import { RUNTIME_BODY_ART } from '../game/render/characters/runtimeDefinitions';
import { createDemoActors } from './rigActors';

vi.mock('../game/render/effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const atlas = new Texture({ source: Texture.WHITE.source }), picture = new Texture({ source: Texture.WHITE.source });
beforeEach(async () => {
    resetBodyTextures();
    vi.spyOn(Assets, 'load').mockImplementation(async url =>
        (String(url).includes('/kit/') ? atlas : picture) as unknown as Record<string, unknown>);
    await loadBodyTextures();
});
afterEach(() => { vi.restoreAllMocks(); resetBodyTextures(); });

describe('rig page source assembly', () => {
    it('shows the 3D-kit robot from its atlas parts in the open-hand pose', () => {
        const world = new Container();
        const robot = createDemoActors(world).find(actor => actor.source.definition.id === 'robot')!;
        // Kit parts sample the atlas: the anatomy copy holds frame pixels and would scramble the crops
        expect(robot.source.definition).toBe(RUNTIME_BODY_ART.robot);
        const meshes = Object.entries(robot.source.meshes);
        expect(meshes.length).toBeGreaterThan(0);
        for (const [id, mesh] of meshes) {
            expect(mesh!.texture, id).toBe(atlas);
            const gripPose = id.startsWith('palm') || id.endsWith('Grip');
            expect(mesh!.visible, id).toBe(!gripPose);
        }
        world.destroy({ children: true });
    });
});
