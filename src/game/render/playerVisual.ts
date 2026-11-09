// A player on screen: the fighter plus what hangs off it (grapple rope, carried flag, lit tank warning).
// The container sits at the player's feet; only the fighter inside it is mirrored.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Entity, GameState, Vector2 } from '../../types';
import { createFighterView, drawFighter, FighterView } from './fighter/fighterView';
import { FighterAnimator } from './fighter/fighterAnimator';
import { RIG_SCALE, upperPoint } from './fighter/fighterPose';
import { drawGrappleRope } from './grappleRope';
import { drawCarriedFlag } from './carriedFlag';
import { clampProneAngle } from '../systems/stance';
import { fighterInSmoke, fighterSmokeVisibility } from './smokeVisibility';
import { spawnShieldAlpha } from './spawnShieldBlink';
import { drawTankWarning, placeTankHalo } from './tankWarning';
import { glowTexture } from './effects/glowTextures';

// Height of the weapon above the feet, used to aim from the right spot on screen
const AIM_HEIGHT = 49;
const AIM_HEIGHT_CROUCHED = 29;
const AIM_HEIGHT_PRONE = 8;

const views = new WeakMap<Container, FighterView>();
// The game screen's fighters. A watched match passes its own animator (matchViewCache) instead.
const pageAnimator = new FighterAnimator();

export const createPlayerVisual = (p: Entity): Container => {
    const c = new Container();
    c.label = p.id;
    // Soft contact shadow so a standing fighter sits on the deck instead of floating in front of it
    const shadow = new Graphics().ellipse(0, 0, 22, 5).fill({ color: 0x000000, alpha: 0.45 });
    shadow.label = 'contactShadow';
    const view = createFighterView();
    const warning = new Graphics();
    warning.label = 'tankWarning';
    // A lit tank's glow washes over the fighter (additive, so it tints instead of hiding it)
    const halo = new Sprite(glowTexture());
    halo.label = 'tankHalo';
    halo.anchor.set(0.5);
    halo.blendMode = 'add';
    halo.visible = false;
    c.addChild(shadow, view.root, halo, warning);
    views.set(c, view);
    return c;
};

export const forgetPlayerVisual = (id: string, animator: FighterAnimator = pageAnimator) => animator.forget(id);

const aimOf = (p: Entity, camera: Vector2, mouse: Vector2, screenW: number, screenH: number, isLocal: boolean) => {
    if (isLocal) {
        const shoulderX = p.pos.x - camera.x + screenW / 2;
        const shoulderY = p.pos.y - (p.isProne ? AIM_HEIGHT_PRONE : p.isCrouching ? AIM_HEIGHT_CROUCHED : AIM_HEIGHT) - camera.y + screenH / 2;
        const angle = Math.atan2(mouse.y - shoulderY, mouse.x - shoulderX);
        return p.isProne ? clampProneAngle(angle) : angle; // the simulation clamps the shots the same way
    }
    // Other humans: aim direction comes from the server; bots look where they move
    if (p.aim !== undefined && Number.isFinite(p.aim)) return p.aim;
    return Math.atan2(p.vel.y, p.facingRight ? 100 : -100);
};

export const updatePlayerVisual = (
    c: Container, p: Entity, camera: Vector2, mouse: Vector2, screenW: number, screenH: number,
    textures: Record<string, Texture | undefined>, isLocal: boolean, game: GameState, now = Date.now(),
    animator: FighterAnimator = pageAnimator,
) => {
    // Another fighter in smoke is hidden whole: body, rope, carried flag and jetpack flame all
    // hang off this container. Your own stays drawn under the cloud; SmokeView outlines it.
    const hidden = !p.dead && fighterSmokeVisibility(fighterInSmoke(game, p, now), isLocal) === 'hidden';
    c.visible = !p.dead && !hidden;
    const view = views.get(c);
    if (p.dead || hidden || !view) return;
    c.alpha = spawnShieldAlpha(p, now); // flickers right after a respawn, solid otherwise
    c.position.set(p.pos.x, p.pos.y);

    const frame = animator.frame(p, aimOf(p, camera, mouse, screenW, screenH, isLocal), now, textures, game);
    drawFighter(view, frame);
    view.root.position.y = -(frame.hop ?? 0); // a one-legged hop lifts the fighter; the contact shadow stays on the deck
    const shadow = c.getChildByLabel('contactShadow');
    if (shadow) shadow.visible = p.isGrounded;

    const toWorld = (pt: Vector2) => ({ x: pt.x * frame.facing * RIG_SCALE, y: pt.y * RIG_SCALE });
    drawGrappleRope(c, p, toWorld(frame.pose.shoulderFront), now);
    drawCarriedFlag(c, p, frame.facing, toWorld(upperPoint(frame.pose, -9, -16)), now, game.mode);
    const warning = c.getChildByLabel('tankWarning');
    if (warning instanceof Graphics) drawTankWarning(warning, p, now);
    const halo = c.getChildByLabel('tankHalo');
    if (halo instanceof Sprite) placeTankHalo(halo, p, now);
};
