// Flag (or intel) carried on the fighter's back, with a glow; Hold the Flag carriers also burn.

import { Container, Graphics } from 'pixi.js';
import { Entity, Team, Vector2 } from '../../types';

const remove = (c: Container, label: string) => {
    const child = c.getChildByLabel(label);
    if (child) { c.removeChild(child); child.destroy({ children: true }); }
};

const ensure = <T extends Container>(c: Container, label: string, make: () => T): T => {
    let child = c.getChildByLabel(label) as T | null;
    if (!child) {
        child = make();
        child.label = label;
        c.addChildAt(child, 0); // behind the fighter
    }
    return child;
};

const flagColor = (p: Entity) => {
    if (p.hasFlag === p.team) return 0xf97316;                        // Hold the Flag
    if (p.hasFlag === Team.RED && p.team === Team.BLUE) return 0xfacc15; // Infiltration intel
    return p.hasFlag === Team.BLUE ? 0x3b82f6 : 0xef4444;
};

/** `back` is the pole's foot relative to the player's feet, in world pixels. */
export const drawCarriedFlag = (c: Container, p: Entity, facing: number, back: Vector2, now: number) => {
    if (p.hasFlag === Team.NONE) {
        ['carriedFlag', 'flagGlow', 'flagFire'].forEach(label => remove(c, label));
        return;
    }
    const color = flagColor(p);

    const glow = ensure(c, 'flagGlow', () => new Graphics());
    const pulse = 1 + Math.sin(now * 0.01) * 0.1;
    glow.clear().circle(0, -40, 45 * pulse).fill({ color, alpha: 0.25 }).circle(0, -40, 35 * pulse).fill({ color, alpha: 0.2 });

    const flag = ensure(c, 'carriedFlag', () => {
        const f = new Container();
        f.addChild(new Graphics().moveTo(0, 0).lineTo(0, -60).stroke({ width: 4, color: 0xffffff }));
        const cloth = new Graphics(); cloth.label = 'cloth'; f.addChild(cloth);
        return f;
    });
    const wave = Math.sin(now * 0.015) * 5;
    (flag.getChildByLabel('cloth') as Graphics).clear().poly([0, -60, 35, -50 + wave, 35, -20 + wave, 0, -30]).fill(color);
    flag.position.set(back.x, back.y);
    flag.scale.x = facing;
    flag.rotation = (-0.1 - p.vel.x * 0.02 * facing) * facing;

    if (p.hasFlag !== p.team) { remove(c, 'flagFire'); return; }
    const fire = ensure(c, 'flagFire', () => new Graphics());
    fire.clear();
    for (let i = 0; i < 6; i++) {
        fire.circle((Math.random() - 0.5) * 20, -64 - Math.random() * 10, 3 + Math.random() * 2).fill({ color: 0xfbbf24, alpha: 0.9 });
    }
};
