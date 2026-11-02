// Cloth geometry: a strip of segments from the pole (u = 0) to the free end (u = 1) with a
// wave travelling toward the free end. Local frame: +x along the cloth, +y down; `angle`
// turns the whole strip clockwise (positive = hanging lower).

import { Vector2 } from '../../../types';

export interface ClothSpec {
    length: number;
    height: number;
    segments: number;
    amp: number;    // wave height at the free end, px
    k: number;      // wave phase across the length, rad
    omega: number;  // wave speed, rad/s
    sag: number;    // droop of the free end, px
    notch: number;  // depth of the swallowtail cut, px (0 = straight end)
}

export interface ClothWind {
    angle: number;
    ampMul: number;
    omegaMul: number;
}

export interface ClothShape {
    top: Vector2[];
    bottom: Vector2[];
    notch: Vector2 | null; // inner point of the swallowtail cut
    shade: number[];       // per segment, -1 (facing up, lit) .. 1 (facing down, in shadow)
}

export const STANDARD_CLOTH: ClothSpec = { length: 88, height: 54, segments: 14, amp: 7, k: 5, omega: 3.2, sag: 6, notch: 16 };

const SHADE_GAIN = 1.8;

const turn = (x: number, y: number, a: number): Vector2 => ({
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
});

export const clothShape = (spec: ClothSpec, wind: ClothWind, t: number): ClothShape => {
    const amp = spec.amp * wind.ampMul;
    const w = spec.omega * wind.omegaMul;
    const step = spec.length / spec.segments;
    const top: Vector2[] = [];
    const bottom: Vector2[] = [];
    const topY: number[] = [];
    let endTop = 0;
    let endBottom = 0;
    for (let i = 0; i <= spec.segments; i++) {
        const u = i / spec.segments;
        const yt = amp * u * Math.sin(t * w - u * spec.k) + spec.sag * u * u;
        const yb = yt + spec.height + amp * 0.25 * u * Math.sin(t * w * 1.3 - u * spec.k + 1);
        topY.push(yt);
        top.push(turn(u * spec.length, yt, wind.angle));
        bottom.push(turn(u * spec.length, yb, wind.angle));
        endTop = yt;
        endBottom = yb;
    }
    const shade: number[] = [];
    for (let i = 0; i < spec.segments; i++) {
        shade.push(Math.max(-1, Math.min(1, ((topY[i + 1] - topY[i]) / step) * SHADE_GAIN)));
    }
    const notch = spec.notch > 0 ? turn(spec.length - spec.notch, (endTop + endBottom) / 2, wind.angle) : null;
    return { top, bottom, notch, shade };
};
