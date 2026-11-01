// Draws the character-setup preview with Pixi, matching how players look in game
// (human, robot, beast and alien styles). Feet stand on y = 0 of the returned container.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SKINS } from '../../constants';
import { ItemType } from '../../types';

export interface CharacterLook {
    skin: (typeof SKINS)[number];
    torso: string;
    head: string;
    arms: string;
    legs: string;
    jetpack: string;
}

const hex = (color: string) => parseInt(color.replace('#', ''), 16);

const createLeg = (thigh: string, shin: string) => {
    const leg = new Container();
    const thighG = new Graphics(); thighG.roundRect(-3, 0, 6, 16, 3).fill(hex(thigh)); leg.addChild(thighG);
    const shinSegment = new Container(); shinSegment.position.set(0, 14); leg.addChild(shinSegment);
    const shinG = new Graphics(); shinG.roundRect(-2, 0, 4, 18, 2).fill(hex(shin)); shinSegment.addChild(shinG);
    const boot = new Graphics(); boot.rect(-4, 16, 10, 4).fill(0x1f2937); shinSegment.addChild(boot);
    return leg;
};

const createArm = (color: string) => {
    const arm = new Container();
    const upper = new Graphics(); upper.roundRect(-3, -2, 18, 6, 3).fill(hex(color)); arm.addChild(upper);
    return arm;
};

const drawHead = (style: string, color: string, accent: number) => {
    const head = new Graphics();
    if (style === 'robot') {
        head.roundRect(-10, -36, 20, 16, 3).fill(hex(color));
        head.rect(-8, -30, 16, 8).fill(accent);
        head.rect(-2, -42, 4, 8).fill(accent);
        return head;
    }
    head.circle(0, -30, 10).fill(hex(color));
    head.rect(4, -34, 6, 8).fill(0x000000);
    head.rect(2, -26, 10, 4).fill(0x333333);
    if (style === 'beast' || style === 'alien') {
        head.moveTo(-10, -34).lineTo(-4, -48).lineTo(0, -34).fill(hex(color));
        head.moveTo(10, -34).lineTo(4, -48).lineTo(0, -34).fill(hex(color));
        head.circle(-4, -36, 2).fill(accent);
        head.circle(4, -36, 2).fill(accent);
    }
    return head;
};

/** Build the character. Arms are labelled 'leftArm' / 'rightArm' so they can be animated. */
export const buildCharacter = (look: CharacterLook, textures: Record<string, Texture>): Container => {
    const root = new Container();
    const style = look.skin.style || 'human';
    const accent = hex(('accent' in look.skin && look.skin.accent) || '#e5e7eb');
    const body = new Container();
    body.position.set(0, -36); // boots end 36px below the body origin: lift so they stand on y = 0
    root.addChild(body);

    const torso = new Graphics();
    torso.roundRect(-9, -24, 18, 28, 4).fill(hex(look.torso));
    if (style === 'robot') {
        torso.rect(-10, -8, 20, 10).fill(accent);
        torso.rect(-6, -20, 12, 6).fill(0x0f172a);
    }
    body.addChild(torso);

    const back = createLeg(look.legs, '#334155'); back.position.set(-2, 2); body.addChild(back);
    const front = createLeg(look.legs, '#334155'); front.position.set(2, 2); body.addChild(front);
    body.addChild(drawHead(style, look.head, accent));

    if (style === 'beast' || style === 'alien') {
        const tail = new Graphics();
        tail.roundRect(-18, -2, 14, 4, 2).fill(accent);
        tail.pivot.set(7, 0);
        tail.position.set(-16, 4);
        tail.rotation = -0.25;
        body.addChild(tail);
    }

    const jetpack = new Graphics(); jetpack.rect(-4, -12, 10, 24).fill(hex(look.jetpack));
    jetpack.position.set(-14, -6); body.addChild(jetpack);

    const leftArm = createArm(look.arms); leftArm.label = 'leftArm'; leftArm.position.set(-8, -20); body.addChild(leftArm);
    const rightArm = createArm(look.arms); rightArm.label = 'rightArm'; rightArm.position.set(0, -20); body.addChild(rightArm);

    const weapon = textures['weapon_machine_gun'] || textures[ItemType.WEAPON];
    if (weapon) {
        const sprite = new Sprite(weapon);
        sprite.anchor.set(0.2, 0.5);
        sprite.scale.set(48 / (Math.max(weapon.width, weapon.height) || 1));
        sprite.position.set(14, 0);
        rightArm.addChild(sprite);
    }
    return root;
};
