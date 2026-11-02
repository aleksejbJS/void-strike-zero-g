// Jetpack nozzles and their flames: where each body's nozzles sit, the flame tongues in the build's flame colour,
// and the nozzle dots. Rig space, upper-body frame (relative to the hip, before lean).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { JetpackId } from '../../../build/buildParts';
import { FighterPose, upperPoint } from '../fighterPose';
import { FighterLook } from '../fighterLook';
import { FLAME_PALETTE } from './flamePalette';

interface Nozzle {
    at: Vector2;     // where the flame starts
    width: number;   // flame width against today's single flame
    length: number;  // flame length against today's single flame
    anti: boolean;   // flickers against the first flame, so two flames never pulse together
}

const nozzle = (x: number, y: number, width = 1, length = 1, anti = false): Nozzle => ({ at: { x, y }, width, length, anti });

const NOZZLES: Record<JetpackId, readonly Nozzle[]> = {
    pack: [nozzle(-8.75, -1)],
    tanks: [nozzle(-10.85, 0, 0.62, 0.95), nozzle(-8.6, -1, 0.62, 0.95, true)],
    rocket: [nozzle(-9.8, 0.6, 1.3, 1.1)],
    wings: [nozzle(-8.6, -0.7)],
    scrap: [nozzle(-10.4, 0, 0.8, 1), nozzle(-7.4, -0.6, 0.6, 0.8, true)],
};

const NOZZLE_DOT = { r: 1.6, lift: 0.2, lit: 0.9, unlit: 0.25 };

export const flameLength = (flicker: number) => 10 + flicker * 5;

/** Where the flames start, in the upper-body frame: one point per flame. */
export const jetpackNozzles = (jetpack: JetpackId): Vector2[] => NOZZLES[jetpack].map(n => ({ ...n.at }));

const flickerOf = (n: Nozzle, flicker: number) => (n.anti ? 1 - flicker : flicker);

/** The middle of every flame in drawing space (where its light sits). */
export const flameMiddles = (pose: FighterPose, jetpack: JetpackId, flicker: number): Vector2[] =>
    NOZZLES[jetpack].map(n => {
        const base = upperPoint(pose, n.at.x, n.at.y);
        const len = flameLength(flickerOf(n, flicker)) * n.length;
        return { x: base.x - pose.lean * len * 0.5, y: base.y + len * 0.5 };
    });

/** Every flame of the build's jetpack: three tongues (outer, middle, core) in the build's flame colours. */
export const drawFlame = (g: Graphics, pose: FighterPose, look: FighterLook, flicker: number) => {
    const c = FLAME_PALETTE[look.build.flame];
    for (const n of NOZZLES[look.build.jetpack]) {
        const base = upperPoint(pose, n.at.x, n.at.y);
        const len = flameLength(flickerOf(n, flicker)) * n.length;
        const tongue = (half: number, reach: number, color: number) =>
            g.poly([base.x - half * n.width, base.y, base.x - pose.lean * len * reach, base.y + len * reach,
                base.x + half * n.width, base.y]).fill(color);
        tongue(3, 1, c.outer);
        tongue(1.6, 0.6, c.mid);
        tongue(0.8, 0.3, c.core);
    }
};

/** Nozzle dots under the jetpack: bright in the flame colour while it burns, dim otherwise. */
export const drawNozzles = (g: Graphics, pose: FighterPose, look: FighterLook, lit: boolean) => {
    const color = FLAME_PALETTE[look.build.flame].nozzle;
    for (const n of NOZZLES[look.build.jetpack]) {
        const p = upperPoint(pose, n.at.x, n.at.y - NOZZLE_DOT.lift);
        g.circle(p.x, p.y, NOZZLE_DOT.r * Math.min(1, n.width)).fill({ color, alpha: lit ? NOZZLE_DOT.lit : NOZZLE_DOT.unlit });
    }
};
