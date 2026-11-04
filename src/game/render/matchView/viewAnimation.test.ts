// Each watched match animates its fighters with its own memory: tiles show the same ids ('host-local',
// 'bot_0'), so a page-wide memory would twitch one tile's fighter when another tile's fires, and closing one
// tile would reset the others. GameCanvas keeps the page-wide animator.

import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { createMockPlayer, createMockState } from '../../../test/mocks';
import { GameMode, Team, WeaponType } from '../../../types';
import { WEAPONS_DATA } from '../../../constants';
import { FighterAnimator } from '../fighter/fighterAnimator';
import { createPlayerVisual, forgetPlayerVisual, updatePlayerVisual } from '../playerVisual';
import { newVisualCache } from './matchViewCache';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const game = createMockState(GameMode.DUEL);
const shooter = (lastFired: number) => {
    const p = createMockPlayer('host-local', Team.BLUE);
    p.weapon = { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] };
    p.lastFired = lastFired;
    return p;
};

describe('per-view fighter animation', () => {
    it('every view cache gets its own animator', () => {
        const a = newVisualCache({});
        const b = newVisualCache({});
        expect(a.animator).toBeInstanceOf(FighterAnimator);
        expect(a.animator).not.toBe(b.animator);
    });

    it('two views with the same player id keep independent state', () => {
        const a = new FighterAnimator();
        const b = new FighterAnimator();
        a.frame(shooter(1), 0, 1000, {}, game);
        expect(a.frame(shooter(2), 0, 1010, {}, game).muzzleFlash).toBeGreaterThan(0); // A saw a new shot
        expect(b.frame(shooter(2), 0, 1010, {}, game).muzzleFlash).toBe(0); // B sees this fighter for the first time
    });

    it('forgetting a fighter in one view does not touch the other', () => {
        const a = new FighterAnimator();
        const b = new FighterAnimator();
        b.frame(shooter(1), 0, 1000, {}, game);
        a.frame(shooter(1), 0, 1000, {}, game);
        forgetPlayerVisual('host-local', a);
        expect(b.frame(shooter(2), 0, 1010, {}, game).muzzleFlash).toBeGreaterThan(0); // B still remembers shot 1
    });

    it('updatePlayerVisual animates with the animator it is given', () => {
        const own = new FighterAnimator();
        const frame = vi.spyOn(own, 'frame');
        const p = shooter(1);
        const c = createPlayerVisual(p);
        updatePlayerVisual(c, p, { x: 0, y: 0 }, { x: 0, y: 0 }, 800, 600, {}, false, game, 1000, own);
        expect(frame).toHaveBeenCalledTimes(1);
        c.destroy({ children: true, context: true });
    });
});
