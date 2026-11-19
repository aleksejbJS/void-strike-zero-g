// Places a fighter view for the flip: the whole picture turns about the body centre, while the gun layer
// gets the inverse transform so the gun stays at the real shot point, aimed at the cursor (spec: shots
// visibly leave the gun). Called by the owner of the root's position (playerVisual), after drawFighter
// has set the root's scale (facing mirror, landing squash).

import { Matrix } from 'pixi.js';
import { STANDING_HEIGHT } from '../../systems/stance';
import type { FighterView } from './fighterView';

/** The flip turns about this point, in px above the feet. */
export const FLIP_CENTER_PX = STANDING_HEIGHT / 2;

const gunMatrix = new Matrix();

/** Root at the feet (lifted by `hop`), turned by `angle` about the body centre; gun layer counter-placed. */
export function applyFlip(view: FighterView, angle: number, hop: number): void {
    const { root, gunLayer } = view;
    if (angle === 0) {
        root.rotation = 0;
        root.position.set(0, -hop);
        gunLayer.position.set(0, 0);
        gunLayer.scale.set(1, 1);
        gunLayer.skew.set(0, 0);
        gunLayer.rotation = 0;
        return;
    }
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cy = -FLIP_CENTER_PX;
    // root: world = P + R·S·local, with P chosen so the centre (0, cy) above the feet stays put
    root.rotation = angle;
    root.position.set(sin * cy, -hop + cy - cos * cy);
    // gun layer: S⁻¹·R⁻¹·S, shifted back by S⁻¹·(c − R⁻¹·c), so its children land where an unturned root puts them
    const sx = root.scale.x, sy = root.scale.y;
    gunMatrix.set(cos, -sin * sx / sy, sin * sy / sx, cos, (-sin * cy) / sx, (cy - cos * cy) / sy);
    gunLayer.setFromMatrix(gunMatrix);
}
