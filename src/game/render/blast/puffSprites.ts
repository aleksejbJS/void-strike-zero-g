// A fixed pool of soft puffs drawn with one of the flame's textures. Each puff moves, slows down, rises, grows,
// turns and fades over its life, and its colour walks along a short ramp. With the pool full, a new puff takes the
// slot of the oldest one. Used for the fireball, the flash and the trails of render/blast. Visual only.

import { Container, Sprite, Texture } from 'pixi.js';
import { flameSprite } from '../flame/spriteKit';

export interface PuffSpec {
    x: number; y: number; vx: number; vy: number;      // px, px/s
    ttl: number;                                        // s
    size0: number; size1: number;                       // px, diameter at birth and at death (fast first, then slow)
    alpha: number;                                      // peak alpha
    drag: number;                                       // 1/s
    rise: number;                                       // px/s^2 upward
    ramp: readonly number[];                            // colours over the life, evenly spaced (at least one)
    fadeIn: number;                                     // share of the life spent fading in
}

interface Puff extends PuffSpec { age: number; rot: number; spin: number; born: number }

const MAX_SPIN = 0.8;                                   // rad/s either way

const channel = (a: number, b: number, shift: number, t: number): number => {
    const x = (a >> shift) & 255, y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t) << shift;
};

/** The colour at `t` (0..1) along `ramp`. */
export const rampAt = (ramp: readonly number[], t: number): number => {
    if (ramp.length === 1) return ramp[0];
    const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(x)), f = x - i;
    const a = ramp[i], b = ramp[i + 1];
    return channel(a, b, 16, f) | channel(a, b, 8, f) | channel(a, b, 0, f);
};

/** Alpha share at `t` (0..1) of a life that fades in over `fadeIn`, then out, smoothly. */
export const puffFade = (t: number, fadeIn: number): number => {
    if (t <= 0 || t >= 1) return 0;
    const f = fadeIn > 0 && t < fadeIn ? t / fadeIn : 1 - (t - fadeIn) / (1 - fadeIn);
    return f * f * (3 - 2 * f);
};

export class PuffSprites {
    readonly layer = new Container();
    private readonly puffs: (Puff | null)[] = [];
    private readonly sprites: Sprite[] = [];
    private readonly free: number[] = [];               // slots of dead puffs
    private serial = 0;                                 // birth order, to find the oldest puff when the pool is full
    private count = 0;

    constructor(private readonly tex: Texture, private readonly additive: boolean, private readonly cap: number) {}

    /** How many puffs are alive. */
    get live(): number {
        return this.count;
    }

    add(spec: PuffSpec): void {
        if (!(spec.ttl > 0) || !Number.isFinite(spec.x) || !Number.isFinite(spec.y)) return;
        let i = this.free.pop();
        if (i === undefined) i = this.puffs.length < this.cap ? this.puffs.length : this.oldest();
        if (this.puffs[i] === null || this.puffs[i] === undefined) this.count++;
        this.puffs[i] = { ...spec, age: 0, rot: Math.random() * Math.PI * 2, spin: (Math.random() * 2 - 1) * MAX_SPIN, born: this.serial++ };
        this.sprites[i] ??= flameSprite(this.layer, this.tex, this.additive);
    }

    /** Move every puff on by `dt` seconds and redraw it; a puff at the end of its life is freed and hidden. */
    update(dt: number): void {
        const { puffs, sprites } = this;
        for (let i = 0; i < puffs.length; i++) {
            const p = puffs[i];
            if (!p) continue;
            p.age += dt;
            const t = p.age / p.ttl;
            if (t >= 1) { this.kill(i); continue; }
            const keep = Math.exp(-p.drag * dt);
            p.vx *= keep;
            p.vy = p.vy * keep - p.rise * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.spin * dt;
            const size = p.size0 + (p.size1 - p.size0) * (1 - (1 - t) * (1 - t));
            const s = sprites[i];
            s.visible = true;
            s.position.set(p.x, p.y);
            s.rotation = p.rot;
            s.scale.set(size / s.texture.width, size / s.texture.height);
            s.tint = rampAt(p.ramp, t);
            s.alpha = p.alpha * puffFade(t, p.fadeIn);
        }
    }

    /** Free every puff (the sprites stay, hidden, for reuse). */
    clear(): void {
        for (let i = 0; i < this.puffs.length; i++) if (this.puffs[i]) this.kill(i);
    }

    /** Destroy the layer and its sprites (the shared flame textures stay); the pool is not usable afterwards. */
    destroy(): void {
        this.layer.destroy({ children: true });
        this.puffs.length = 0;
        this.sprites.length = 0;
        this.free.length = 0;
        this.count = 0;
    }

    private kill(i: number): void {
        this.puffs[i] = null;
        this.sprites[i].visible = false;
        this.free.push(i);
        this.count--;
    }

    // Only when the pool is full and no slot is free: every slot holds a live puff
    private oldest(): number {
        let best = 0;
        for (let i = 1; i < this.puffs.length; i++) if (this.puffs[i]!.born < this.puffs[best]!.born) best = i;
        return best;
    }
}
