import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { GameMode, Team } from '../../../types';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { loadBodyTextures, resetBodyTextures } from '../characters/textures';
import { createFighterView, drawFighter, type FighterView } from './fighterView';
import { FighterAnimator } from './fighterAnimator';
import { RIG_SCALE } from './fighterPose';
import { stumpTip } from './fighterStump';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));
const views: FighterView[] = [];
let missing = '';
beforeEach(async () => {
    missing = ''; resetBodyTextures();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async url => {
        if (missing && String(url).endsWith(missing)) throw new Error('Picture unavailable');
        return Texture.WHITE as unknown as Record<string, unknown>;
    });
    await loadBodyTextures();
});
afterEach(() => {
    for (const view of views.splice(0)) view.root.destroy({ children: true, context: true });
    resetBodyTextures(); vi.restoreAllMocks();
});
const animate = (state: 'walk' | 'crouch' | 'prone', facing: 1 | -1, body: 'human' | 'robot' = 'human') => {
    const player = createMockPlayer('bleeding', Team.BLUE), game = createMockState(GameMode.DEATHMATCH);
    player.pos = { x: 100, y: 500 }; player.wound = { by: 'shooter' }; player.isGrounded = true;
    player.vel.x = facing; player.isCrouching = state === 'crouch'; player.isProne = state === 'prone';
    player.build = { ...DEFAULT_BUILD, body, helmet: 'none', visor: 'none' };
    const frame = new FighterAnimator().frame(player, facing === 1 ? 0 : Math.PI, 1000, {}, game);
    const view = createFighterView(); views.push(view); drawFighter(view, frame);
    const drops = game.particles.filter(particle => particle.type === 'blood');
    expect(drops).toHaveLength(1);
    return { player, frame, view, drop: drops[0] };
};

describe('Human blood emitter and the painted missing-leg cap', () => {
    it.each(['walk', 'crouch', 'prone'] as const)('emits at the rendered %s wound with mirroring and hop preserved', state => {
        for (const facing of [1, -1] as const) {
            const { player, frame, view, drop } = animate(state, facing);
            const cap = view.humanWounds!.meshes.hipBack!;
            expect(cap.visible).toBe(true);
            expect(drop.pos.x).toBeCloseTo(player.pos.x + cap.position.x * facing * RIG_SCALE);
            expect(drop.pos.y).toBeCloseTo(player.pos.y + cap.position.y * RIG_SCALE - (frame.hop ?? 0));
            if (state === 'walk') expect(frame.hop).toBeGreaterThan(0);
        }
    });

    it('keeps non-Human blood on the existing procedural stump', () => {
        const { player, frame, view, drop } = animate('crouch', -1, 'robot'), tip = stumpTip(frame.pose);
        expect(view.humanWounds).toBeUndefined();
        expect(drop.pos.x).toBeCloseTo(player.pos.x - tip.x * RIG_SCALE);
        expect(drop.pos.y).toBeCloseTo(player.pos.y + tip.y * RIG_SCALE - (frame.hop ?? 0));
    });

    it.each(['/human-v3/damage.png', '/atompunk/human.png'])('uses the original stump when %s prevents the painted cap', async path => {
        missing = path; resetBodyTextures(); await loadBodyTextures();
        const { player, frame, view, drop } = animate('prone', -1), tip = stumpTip(frame.pose);
        expect(view.humanWounds).toBeUndefined();
        expect(drop.pos.x).toBeCloseTo(player.pos.x - tip.x * RIG_SCALE);
        expect(drop.pos.y).toBeCloseTo(player.pos.y + tip.y * RIG_SCALE - (frame.hop ?? 0));
    });
});
