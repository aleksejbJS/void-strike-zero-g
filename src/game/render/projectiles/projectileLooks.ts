// How each weapon's projectile looks. Pure drawing: every function repaints one pooled
// ProjectileSprite from the projectile's current state, so nothing is kept between frames.
//
// A ProjectileSprite is a `root` placed at the projectile with three layers inside it,
// listed from the bottom up so the solid art and the hot core always sit over the light:
//   glow  additive soft light
//   strip additive streak anchored at (1, 0.5): a tracer behind the head, or the rocket exhaust
//   body  solid art (rocket, grenade, plasma core); Graphics, repainted each frame
// Nothing is ever a plain dot: even a bullet is a streak with a hot head and a glow.

import { Container, Graphics, Sprite } from 'pixi.js';
import { Projectile, Vector2, WeaponType } from '../../../types';
import { PHYSICS_TICK_RATE, WEAPONS_DATA } from '../../../constants';
import { glowTexture, stripTexture } from '../effects/glowTextures';

export type ProjectileSprite = { root: Container; strip: Sprite; glow: Sprite; body: Graphics };

const WHITE = 0xffffff;
const MG_TINT = 0xfbbf24;          // yellow
const PELLET_TINT = 0xfb923c;      // orange
const MG_GLOW = 0xffdc8c;
const PLASMA_GLOW = 0x60a5fa;
const PLASMA_GHOST = 0x60a5fa;
const EXHAUST_TINT = 0xffc070;     // the strip is white at its head, so the tint sets the flame colour
const EXHAUST_GLOW = 0xfb923c;
const HULL = 0x9aa4b2, HULL_LINE = 0x1f2630, NOSE = 0xef4444, FIN = 0x64748b;
type ShellColors = { shell: number; line: number; band: number };
const GRENADE: ShellColors = { shell: 0x365314, line: 0x1a2a0a, band: 0xa3e635 };
const SMOKE_ROUND: ShellColors = { shell: 0x4b5563, line: 0x1f2937, band: 0x9ca3af }; // grey: the weapon colour

const GHOST_INDEXES = [2, 4, 6];   // which remembered positions get a ghost orb
const PLASMA_PULSE_HZ = 4.5;
const GRENADE_SPIN = 0.125;        // rad per tick: the mockup's 0.25 per 60 Hz frame at 120 ticks/s

export const newProjectileSprite = (): ProjectileSprite => {
    const body = new Graphics();
    const strip = new Sprite(stripTexture());
    strip.anchor.set(1, 0.5);
    strip.blendMode = 'add';
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    const root = new Container();
    root.addChild(glow, strip, body);
    return { root, strip, glow, body };
};

const heading = (p: Projectile): number => Math.atan2(p.vel.y, p.vel.x);

const placeStrip = (v: ProjectileSprite, x: number, y: number, angle: number, length: number, thickness: number, tint: number | string) => {
    const s = v.strip;
    s.visible = true;
    s.position.set(x, y);
    s.rotation = angle;
    s.width = length;
    s.height = thickness;
    s.tint = tint;
};

const placeGlow = (v: ProjectileSprite, x: number, y: number, radius: number, tint: number | string, alpha: number) => {
    const g = v.glow;
    g.visible = true;
    g.position.set(x, y);
    g.width = g.height = radius * 2;
    g.tint = tint;
    g.alpha = alpha;
};

// A streak behind the head with a white-hot core line, and optionally a glow at the head
const tracer = (v: ProjectileSprite, p: Projectile, length: number, thickness: number, tint: number | string, glow?: { radius: number; tint: number }) => {
    const angle = heading(p);
    placeStrip(v, 0, 0, angle, length, thickness, tint);
    v.body.rotation = angle;
    v.body.moveTo(-length * 0.25, 0).lineTo(1, 0).stroke({ width: thickness * 0.45, color: WHITE, alpha: 0.9, cap: 'round' });
    if (glow) placeGlow(v, 0, 0, glow.radius, glow.tint, 0.7);
};

// Pulsing blue glow, white core, and three fading ghost orbs where the orb was a few frames ago
const plasma = (v: ProjectileSprite, p: Projectile, trail: readonly Vector2[], age: number) => {
    const pulse = 1 + 0.15 * Math.sin((age * 2 * Math.PI * PLASMA_PULSE_HZ) / PHYSICS_TICK_RATE);
    placeGlow(v, 0, 0, 14 * pulse, PLASMA_GLOW, 0.9);
    v.body.blendMode = 'add';
    for (const i of GHOST_INDEXES) {
        const spot = trail[i];
        if (!spot) continue;
        v.body.circle(spot.x - p.pos.x, spot.y - p.pos.y, 5 * (1 - i / 8)).fill({ color: PLASMA_GHOST, alpha: 0.25 * (1 - i / 7) });
    }
    v.body.circle(0, 0, 4).fill(WHITE);
};

// Irregular 0..1 wobble for the exhaust length; the age phase keeps two rockets out of step
const flicker = (nowMs: number, age: number): number =>
    0.5 + 0.25 * Math.sin(nowMs * 0.11 + age) + 0.25 * Math.sin(nowMs * 0.043 + age * 2.3);

// Grey capsule with a red nose, two fins and a highlight; the exhaust is the strip behind it
const rocket = (v: ProjectileSprite, p: Projectile, age: number, nowMs: number) => {
    const angle = heading(p);
    const b = v.body;
    b.rotation = angle;
    b.roundRect(-9, -2.5, 15, 5, 2).fill(HULL).stroke({ width: 1, color: HULL_LINE });
    b.poly([6, -2.5, 11, 0, 6, 2.5]).fill(NOSE);
    b.poly([-9, -2.5, -12, -5, -7, -2.5]).fill(FIN);
    b.poly([-9, 2.5, -12, 5, -7, 2.5]).fill(FIN);
    b.rect(-8, -2, 12, 1.2).fill({ color: WHITE, alpha: 0.35 });
    const cos = Math.cos(angle), sin = Math.sin(angle);
    placeStrip(v, -9 * cos, -9 * sin, angle, 10 + 6 * flicker(nowMs, age), 5.2, EXHAUST_TINT);
    placeGlow(v, -12 * cos, -12 * sin, 14, EXHAUST_GLOW, 0.55);
};

// A ball with a band and a highlight, spinning from the moment it was fired: dark green with a
// lime band for the grenade, dark grey with a light grey band for the smoke round
const grenade = (v: ProjectileSprite, age: number, colors: ShellColors) => {
    const b = v.body;
    b.rotation = age * GRENADE_SPIN;
    b.circle(0, 0, 4.5).fill(colors.shell).stroke({ width: 1, color: colors.line });
    b.rect(-4.5, -1, 9, 2).fill(colors.band);
    b.circle(-1.5, -1.8, 1.4).fill({ color: WHITE, alpha: 0.35 });
};

/** Repaint one pooled projectile sprite. `trail` is the remembered positions, newest first; `age` is ticks since the view first saw it. */
export const drawProjectile = (v: ProjectileSprite, p: Projectile, trail: readonly Vector2[], age: number, nowMs: number): void => {
    v.root.position.set(p.pos.x, p.pos.y);
    v.body.clear();
    v.body.rotation = 0;
    v.body.blendMode = 'normal';
    v.strip.visible = false;
    v.glow.visible = false;
    switch (p.type) {
        case WeaponType.MACHINE_GUN: return tracer(v, p, 24, 3, MG_TINT, { radius: 9, tint: MG_GLOW });
        case WeaponType.SHOTGUN: return tracer(v, p, 10, 2.2, PELLET_TINT);
        case WeaponType.PLASMA_GUN: return plasma(v, p, trail, age);
        case WeaponType.ROCKET_LAUNCHER: return rocket(v, p, age, nowMs);
        case WeaponType.GRENADE_LAUNCHER: return grenade(v, age, GRENADE);
        case WeaponType.SMOKE_LAUNCHER: return grenade(v, age, SMOKE_ROUND);
        // The railgun is a beam and the chainsaw melee, so these never fly; a tracer in the weapon colour if one ever does
        default: return tracer(v, p, 24, 3, WEAPONS_DATA[p.type]?.color ?? '#ffffff', { radius: 9, tint: MG_GLOW });
    }
};
