import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE } from '../fighter/fighterPose';
import { createCorpseView, destroyCorpseView, updateCorpseView } from '../ragdoll/corpseView';
import { loadBodyTextures, resetBodyTextures } from './textures';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));
beforeEach(async () => {
    resetBodyTextures();
    vi.spyOn(Assets, 'load').mockResolvedValue(Texture.WHITE as unknown as Record<string, unknown>);
    await loadBodyTextures();
});
afterEach(() => { vi.restoreAllMocks(); resetBodyTextures(); });

it.each(['fall', 'gib', 'cut'] as const)('redraws a still %s boot when only support contact changes', kind => {
    const c = createCorpse({ x: 100, y: 500, kind, facing: 1,
        parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff',
            build: { ...DEFAULT_BUILD, body: 'human', helmet: 'none', visor: 'none' } } });
    c.points.knF.x = 100; c.points.anF.x = 120;
    c.points.knF.y = c.points.anF.y = 500 - 3 * RIG_SCALE;
    const view = createCorpseView(c, {});
    const foot = (view.fighter?.illustrated ?? view.illustrated!.rig).meshes.footFront!;
    expect(Math.abs(foot.rotation)).toBeGreaterThan(1);
    c.points.anF.supported = true;
    updateCorpseView(view, c);
    expect(foot.rotation).toBe(0);
    c.points.anF.supported = false;
    updateCorpseView(view, c);
    expect(Math.abs(foot.rotation)).toBeGreaterThan(1);
    destroyCorpseView(view);
});
