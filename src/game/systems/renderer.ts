import { Container, Graphics, Sprite, Text, Texture, BlurFilter, Filter, GlProgram, Matrix } from 'pixi.js';
// Bloom filter replaced with BlurFilter for glow effect
import { GameState, Platform, Entity, WeaponType, ItemType, Pickup, Team, MapId } from '../../types';
import { WEAPONS_DATA, GUN_GAME_LADDER } from '../../constants';
import { createPlayerVisual, forgetPlayerVisual, updatePlayerVisual } from '../render/playerVisual';
import { nextHungerZone } from './gamemodes';
import { ParticleView } from '../render/effects/particleView';
import { ProjectileView } from '../render/projectiles/projectileView';
import { BeamView } from '../render/projectiles/beamView';
import { SmokeView } from '../render/effects/smokeView';
import { smokeSilhouette } from '../render/smokeVisibility';
import { firstPelletPerOwner } from '../render/projectiles/projectileMemory';
import { createParticles } from './effectSpawn';
import { hudHealth } from './hudHealth';
import { createGroundFlagVisual, updateGroundFlagVisual } from '../render/flag/groundFlagView';
import { syncCorpseViews } from '../render/ragdoll/corpseView';
import { toView, Viewport } from '../render/viewport';

// Desired visual sizes (largest dimension) for pickup sprites
const PICKUP_DISPLAY_SIZE: Partial<Record<ItemType, number>> = {
    // Unified size for standard pickups (flags are drawn by render/flag/)
    [ItemType.HEALTH]: 54,
    [ItemType.ARMOR]: 54,
    [ItemType.AMMO]: 54,
    [ItemType.FUEL]: 54,
    [ItemType.WEAPON]: 54,
    [ItemType.INTEL]: 64
};

const BENEFICIAL_ITEMS = new Set<ItemType>([
    ItemType.HEALTH,
    ItemType.ARMOR,
    ItemType.AMMO,
    ItemType.FUEL
]);

export const getPickupSpriteScale = (type: ItemType, texture: Texture) => {
    const targetSize = PICKUP_DISPLAY_SIZE[type] ?? 32;
    const baseSize = Math.max(texture.width, texture.height) || 1;
    return targetSize / baseSize;
};

export const drawStaticMap = (layer: Graphics, platforms: Platform[], mapId: MapId, cache: any) => {
    layer.clear();

    // Clear previous sprites if any (we might need a container for sprites instead of drawing on Graphics)
    // Actually, drawStaticMap is called once or rarely.
    // But layer is a Graphics object. We can't add Sprites to it directly if we want to keep using it as a Graphics layer.
    // However, the 'world' container contains 'staticLayer' which is a Graphics.
    // We should probably change 'staticLayer' to be a Container if we want to use Sprites.
    // For now, let's just use Graphics with texture fill if possible, or just draw rects.
    // PixiJS Graphics supports beginTextureFill.

    platforms.forEach(p => {
        if (mapId === MapId.TUNNELS) {
            const baseColor = p.y < 0 ? 0x2b1c14 : 0x3b2a20;
            const bandHeight = Math.min(14, Math.max(8, p.h * 0.25));
            const accentHeight = Math.max(3, bandHeight * 0.35);

            // Main body
            layer.rect(p.x, p.y, p.w, p.h).fill(baseColor).stroke({ width: 2, color: 0x1f130d, alpha: 0.4 });

            // Grass/soil cap
            layer.rect(p.x, p.y, p.w, bandHeight).fill(0x7cbf38);
            layer.rect(p.x, p.y + bandHeight * 0.55, p.w, accentHeight).fill(0xe5e7eb);

            // Simple dotted noise for soil texture
            for (let x = p.x + 6; x < p.x + p.w; x += 18) {
                const y = p.y + bandHeight + ((x + p.y) % 12);
                if (y < p.y + p.h - 4) {
                    layer.circle(x, y, 1.5).fill(0x24160f);
                    layer.circle(x + 6, y + 4, 1).fill(0x1a100b);
                }
            }
        } else {
            let color = 0x334155; let stroke = 0x475569;
            if (p.color === '#3b82f6') { color = 0x1e3a8a; stroke = 0x3b82f6; }
            else if (p.color === '#ef4444') { color = 0x7f1d1d; stroke = 0xef4444; }

            layer.rect(p.x, p.y, p.w, p.h).fill(color).stroke({ width: 2, color: stroke });
            layer.moveTo(p.x, p.y + 2).lineTo(p.x + p.w, p.y + 2).stroke({ width: 2, color: 0xffffff, alpha: 0.1 });

            if (p.w > 40 && p.h > 40) {
                layer.circle(p.x + 10, p.y + 10, 3).fill(0x000000); layer.circle(p.x + p.w - 10, p.y + 10, 3).fill(0x000000);
                layer.circle(p.x + 10, p.y + p.h - 10, 3).fill(0x000000); layer.circle(p.x + p.w - 10, p.y + p.h - 10, 3).fill(0x000000);
            }
            if (p.h > p.w) {
                for (let y = p.y; y < p.y + p.h; y += 40) layer.moveTo(p.x, y).lineTo(p.x + p.w, y).stroke({ width: 2, color: 0x000000, alpha: 0.2 });
            } else if (p.w > p.h && p.h < 60) {
                layer.rect(p.x, p.y + p.h - 10, p.w, 10).fill(0x000000);
                for (let x = p.x; x < p.x + p.w; x += 20) layer.poly([x, p.y + p.h - 10, x + 10, p.y + p.h - 10, x, p.y + p.h]).fill(0xf59e0b);
            }
        }
    });
};

export const drawBackground = (layer: Graphics, w: number, h: number) => {
    layer.clear();
    layer.rect(-2000, -2000, 6000, 6000).fill(0x020617);
    for (let i = 0; i < w * 4; i += 100) layer.moveTo(i - 1000, -2000).lineTo(i - 1000, 3000).stroke({ width: 2, color: 0x1e293b, alpha: 0.3 });
};

export const drawZoneOverlay = (layer: Graphics, hungerZone: any, time: number = Date.now()) => {
    layer.clear();
    if (!hungerZone) return;

    const hz = hungerZone;
    const t = time * 0.001; // Time in seconds for animations

    // 1. Darken area OUTSIDE the safe zone
    const mapBounds = { x: -3000, y: -2000, w: 9000, h: 4000 };
    layer.rect(mapBounds.x, mapBounds.y, mapBounds.w, mapBounds.h)
        .fill({ color: 0x000000, alpha: 0.4 });

    // Cut out the safe zone (make it bright)
    layer.rect(hz.x, hz.y, hz.w, hz.h)
        .cut();

    // 2. Animated border - pulsing glow effect
    const pulse = 0.5 + Math.sin(t * 2) * 0.2; // Pulsate between 0.3 - 0.7
    const glowSize = 8 + Math.sin(t * 3) * 3;

    // Outer glow
    layer.rect(hz.x - glowSize, hz.y - glowSize, hz.w + glowSize * 2, hz.h + glowSize * 2)
        .stroke({ width: glowSize * 2, color: 0x84cc16, alpha: pulse * 0.3 });

    // Main border - solid line
    layer.rect(hz.x, hz.y, hz.w, hz.h)
        .stroke({ width: 4, color: 0x84cc16, alpha: 0.8 });

    // Inner glow
    layer.rect(hz.x + 4, hz.y + 4, hz.w - 8, hz.h - 8)
        .stroke({ width: 2, color: 0xbef264, alpha: pulse * 0.6 });

    // 3. Energy particles along the border
    const particleCount = 40;
    const perimeter = (hz.w + hz.h) * 2;
    const particleSpeed = t * 50; // Move particles along perimeter

    for (let i = 0; i < particleCount; i++) {
        const offset = (i / particleCount) * perimeter + particleSpeed;
        const normalizedPos = (offset % perimeter) / perimeter;

        let px, py;
        if (normalizedPos < hz.w / perimeter) {
            // Top edge
            px = hz.x + (normalizedPos * perimeter);
            py = hz.y;
        } else if (normalizedPos < (hz.w + hz.h) / perimeter) {
            // Right edge
            px = hz.x + hz.w;
            py = hz.y + ((normalizedPos * perimeter) - hz.w);
        } else if (normalizedPos < (hz.w * 2 + hz.h) / perimeter) {
            // Bottom edge
            px = hz.x + hz.w - ((normalizedPos * perimeter) - (hz.w + hz.h));
            py = hz.y + hz.h;
        } else {
            // Left edge
            px = hz.x;
            py = hz.y + hz.h - ((normalizedPos * perimeter) - (hz.w * 2 + hz.h));
        }

        const particleSize = 2 + Math.sin(t * 4 + i) * 1;
        const particleAlpha = 0.4 + Math.sin(t * 3 + i * 0.5) * 0.3;
        layer.circle(px, py, particleSize)
            .fill({ color: 0xd9f99d, alpha: particleAlpha });
    }

    // 4. Next zone preview (if shrinking soon)
    if (hz.pendingShrink) {
        // Same rule as the real shrink, so the warning shows exactly where the zone goes
        const { x: nx, y: ny, w: nw, h: nh } = nextHungerZone(hz);

        // Warning pulse - faster when shrinking is imminent
        const warningPulse = 0.3 + Math.sin(t * 5) * 0.25;

        // Outer warning glow
        layer.rect(nx - 6, ny - 6, nw + 12, nh + 12)
            .stroke({ width: 8, color: 0xf97316, alpha: warningPulse * 0.4 });

        // Next zone border
        layer.rect(nx, ny, nw, nh)
            .stroke({ width: 3, color: 0xfb923c, alpha: 0.8 });

        // Danger particles - more chaotic
        const dangerParticles = 30;
        const dangerPerimeter = (nw + nh) * 2;

        for (let i = 0; i < dangerParticles; i++) {
            const offset = (i / dangerParticles) * dangerPerimeter + particleSpeed * 1.5;
            const normalizedPos = (offset % dangerPerimeter) / dangerPerimeter;

            let px, py;
            if (normalizedPos < nw / dangerPerimeter) {
                px = nx + (normalizedPos * dangerPerimeter);
                py = ny;
            } else if (normalizedPos < (nw + nh) / dangerPerimeter) {
                px = nx + nw;
                py = ny + ((normalizedPos * dangerPerimeter) - nw);
            } else if (normalizedPos < (nw * 2 + nh) / dangerPerimeter) {
                px = nx + nw - ((normalizedPos * dangerPerimeter) - (nw + nh));
                py = ny + nh;
            } else {
                px = nx;
                py = ny + nh - ((normalizedPos * dangerPerimeter) - (nw * 2 + nh));
            }

            const shake = Math.sin(t * 8 + i * 0.3) * 4; // Shaky particles
            const psize = 1.5 + Math.sin(t * 6 + i) * 0.8;
            layer.circle(px + shake, py + shake, psize)
                .fill({ color: 0xfed7aa, alpha: 0.6 + Math.sin(t * 4 + i) * 0.2 });
        }
    }
};

const getWeaponTexture = (item: Pickup, cache: any, fallback?: Texture) => {
    if (item.type !== ItemType.WEAPON || !item.subtype) return fallback;
    const key = `weapon_${item.subtype.toLowerCase?.() ?? String(item.subtype).toLowerCase()}`;
    return cache.textures[key] || fallback;
};

const createPickupVisual = (item: Pickup, cache: any) => {
    if (item.type === ItemType.FLAG) return createGroundFlagVisual(item);
    const c = new Container();
    const halo = new Graphics(); halo.label = 'halo'; c.addChild(halo);
    const texture = item.type === ItemType.WEAPON ? getWeaponTexture(item, cache) : cache.textures[item.type];
    if (texture) {
        const baseScale = getPickupSpriteScale(item.type, texture);
        const scale = item.type === ItemType.WEAPON && item.subtype === WeaponType.SHOTGUN
            ? baseScale * 1.4
            : item.type === ItemType.WEAPON && item.subtype === WeaponType.CHAINSAW
                ? baseScale * 1.25
                : baseScale;
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.scale.set(scale);
        sprite.label = 'sprite';
        c.addChild(sprite);
    } else { const g = new Graphics(); g.label = 'g'; c.addChild(g); }
    return c;
};

const updatePickupVisual = (c: Container, item: Pickup, cache: any) => {
    if (!item.active) { c.visible = false; return; }
    c.visible = true;
    c.position.set(item.pos.x, item.pos.y);

    // Add floating animation for all pickups
    const floatOffset = Math.sin(Date.now() * 0.003) * 5;
    c.position.y += floatOffset;

    // Beneficial glow
    const halo = c.getChildByLabel('halo') as Graphics;
    if (halo) {
        halo.clear();
        if (item.type === ItemType.INTEL) {
            const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.12;
            const baseSize = (PICKUP_DISPLAY_SIZE[item.type] ?? 48) * 0.8;
            const r = (baseSize * pulse) / 2;
            const color = 0xf59e0b;
            halo.visible = true;
            halo.circle(0, 0, r + 4).stroke({ width: 2, color, alpha: 0.4 });
            halo.circle(0, 0, r).fill({ color, alpha: 0.18 });
        } else if (item.type === ItemType.WEAPON) {
            const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.08;
            const sizeMul =
                item.subtype === WeaponType.SHOTGUN ? 1.2 :
                    item.subtype === WeaponType.ROCKET_LAUNCHER ? 1.2 :
                        1.0;
            const baseSize = (PICKUP_DISPLAY_SIZE[item.type] ?? 32) * sizeMul;
            const r = (baseSize * pulse) / 2;
            const color = item.subtype === WeaponType.ROCKET_LAUNCHER
                ? 0xef4444
                : item.subtype === WeaponType.RAILGUN
                    ? 0x60a5fa
                    : item.subtype === WeaponType.CHAINSAW
                        ? 0xef4444
                        : 0x94a3b8; // red for rockets/chainsaw, blue for railgun, gray for others
            halo.visible = true;
            halo.circle(0, 0, r + 3).stroke({ width: 2, color, alpha: 0.3 });
            halo.circle(0, 0, r).fill({ color, alpha: 0.12 });
        } else if (BENEFICIAL_ITEMS.has(item.type)) {
            const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.1;
            const baseSize = (PICKUP_DISPLAY_SIZE[item.type] ?? 32) * 0.85;
            const r = (baseSize * pulse) / 2;
            const color = item.type === ItemType.AMMO ? 0xfacc15 : 0x22c55e; // brighter yellow for ammo
            halo.visible = true;
            halo.circle(0, 0, r + 4).stroke({ width: 2, color, alpha: 0.35 });
            halo.circle(0, 0, r).fill({ color, alpha: 0.18 });
        } else {
            halo.visible = false;
        }
    }

    const sprite = c.getChildByLabel('sprite') as Sprite;
    if (sprite) {
        sprite.visible = true;
        if (item.type === ItemType.WEAPON) {
            sprite.tint = 0xffffff;
        }
        return;
    }
    const g = c.getChildByLabel('g') as Graphics; if (!g) return;
    g.clear();

    if (item.type === ItemType.WEAPON && item.subtype) {
        const weaponData = WEAPONS_DATA[item.subtype];
        const color = weaponData.color;

        // Pulsing glow background
        const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.15;
        g.circle(0, -15, 25 * pulse).fill({ color, alpha: 0.2 });
        g.circle(0, -15, 20 * pulse).stroke({ width: 2, color, alpha: 0.4 });

        // Draw weapon-specific icons
        if (item.subtype === WeaponType.SHOTGUN) {
            // Double barrel shotgun
            g.rect(-18, -18, 30, 4).fill(0x57534e);
            g.rect(-18, -12, 30, 4).fill(0x57534e);
            g.rect(12, -20, 8, 10).fill(color);
            g.circle(-16, -16, 3).fill(0x1e293b);
            g.circle(-16, -10, 3).fill(0x1e293b);
        } else if (item.subtype === WeaponType.ROCKET_LAUNCHER) {
            // Rocket launcher
            g.rect(-15, -18, 30, 12).fill(0x57534e);
            g.rect(15, -22, 10, 20).fill(color);
            g.poly([15, -22, 25, -12, 15, -2]).fill(0xef4444);
            g.rect(-12, -15, 4, 6).fill(0x1e293b);
        } else if (item.subtype === WeaponType.RAILGUN) {
            // Sniper/railgun - long barrel
            g.rect(-20, -16, 35, 8).fill(0x1e293b);
            g.rect(15, -14, 8, 4).fill(color);
            g.circle(18, -12, 3).fill(0x60a5fa);
            g.rect(-18, -13, 10, 2).fill(color);
        } else if (item.subtype === WeaponType.PLASMA_GUN) {
            // Plasma gun with energy coils
            g.rect(-12, -16, 24, 8).fill(0x1e40af); // Dark blue body
            g.rect(12, -14, 6, 4).fill(color);
            g.circle(-8, -12, 3).fill(0x60a5fa); // Light blue coils
            g.circle(-2, -12, 3).fill(0x60a5fa);
            g.circle(4, -12, 3).fill(0x60a5fa);
        } else if (item.subtype === WeaponType.GRENADE_LAUNCHER) {
            // Grenade launcher
            g.rect(-15, -16, 28, 10).fill(0x65a30d);
            g.circle(13, -11, 8).fill(color);
            g.circle(13, -11, 5).fill(0x84cc16);
            g.rect(-12, -13, 4, 4).fill(0x1e293b);
        } else if (item.subtype === WeaponType.CHAINSAW) {
            // Chainsaw blade and handle
            g.rect(-20, -14, 34, 8).fill(0x7f1d1d);
            g.roundRect(10, -18, 14, 16, 2).fill(color);
            g.circle(16, -10, 5).fill(0xfbbf24);
            g.rect(-16, -10, 12, 4).fill(0x111827);
        } else {
            // Machine gun (default)
            g.rect(-14, -16, 26, 8).fill(0x1e293b);
            g.rect(12, -14, 8, 4).fill(0x94a3b8);
            g.rect(-10, -13, 18, 2).fill(color);
        }
    } else if (item.type === ItemType.HEALTH) {
        // Enhanced health pack with larger, clearer cross
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        g.circle(0, -18, 22 * pulse).fill(0x22c55e);
        g.circle(0, -18, 18).fill(0x16a34a);
        // White cross
        g.rect(-12, -22, 24, 8).fill(0xffffff);
        g.rect(-4, -30, 8, 24).fill(0xffffff);
        // Add shine
        g.circle(-6, -24, 3).fill({ color: 0xffffff, alpha: 0.6 });
    } else if (item.type === ItemType.ARMOR) {
        // Enhanced shield with better details
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        g.circle(0, -15, 20 * pulse).fill({ color: 0x3b82f6, alpha: 0.3 });
        g.poly([0, -30, -18, -24, -18, -8, 0, -2, 18, -8, 18, -24]).fill(0x1e40af);
        g.poly([0, -28, -15, -23, -15, -10, 0, -5, 15, -10, 15, -23]).fill(0x3b82f6);
        g.poly([0, -25, -10, -21, -10, -12, 0, -8, 10, -12, 10, -21]).fill(0x60a5fa);
        // Add shine
        g.circle(-5, -20, 3).fill({ color: 0xffffff, alpha: 0.5 });
    } else if (item.type === ItemType.INTEL) {
        g.roundRect(-18, -10, 36, 24, 3).fill({ color: 0xfacc15, alpha: 0.8 }).stroke({ width: 2, color: 0xca8a04, alpha: 0.9 });
        g.roundRect(-10, -14, 20, 6, 2).fill(0xfde68a).stroke({ width: 2, color: 0xca8a04, alpha: 0.8 });
        g.circle(6, 2, 4).fill({ color: 0xef4444, alpha: 0.9 });
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        g.circle(0, 0, 20 * pulse).stroke({ width: 2, color: 0xf59e0b, alpha: 0.25 });
    } else if (item.type === ItemType.AMMO) {
        // Enhanced ammo box with better details
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        g.circle(0, -15, 20 * pulse).fill({ color: 0xeab308, alpha: 0.3 });
        // Box
        g.roundRect(-15, -28, 30, 22, 3).fill(0xa16207);
        g.roundRect(-13, -26, 26, 18, 2).fill(0xeab308);
        g.roundRect(-11, -24, 22, 14, 2).fill(0xfbbf24);
        // Bullets inside
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                const x = -6 + i * 6;
                const y = -20 + j * 6;
                g.circle(x, y, 2).fill(0x78350f);
            }
        }
        // Shine
        g.circle(-8, -22, 2).fill({ color: 0xffffff, alpha: 0.6 });
    }
};

/** `view` is the virtual screen the world is drawn on; `mouse` is in window pixels. */
export const syncVisuals = (view: Viewport, world: Container, gameLayer: Container, decalLayer: Container, uiLayer: Container, state: GameState, cache: any, shakeRef: any, mouse: { x: number, y: number }, setStats: any, setPlayerInventory: any, setActiveWeaponType: any, setScores: any, setPlayerScores?: any, localPlayerId = 'player') => {
    let shakeX = (Math.random() - 0.5) * shakeRef.current;
    let shakeY = (Math.random() - 0.5) * shakeRef.current;
    // Apply filters
    world.filters = null;
    shakeRef.current *= 0.9;

    const cx = view.w / 2;
    const cy = view.h / 2;
    world.position.set(cx - state.camera.x + shakeX, cy - state.camera.y + shakeY);

    // Decals
    for (const [id, gfx] of cache.decals.entries()) { if (!state.decals.find(d => d.id === id)) { decalLayer.removeChild(gfx); gfx.destroy(); cache.decals.delete(id); } }
    state.decals.forEach(d => {
        let gfx = cache.decals.get(d.id);
        if (!gfx) {
            gfx = new Graphics(); decalLayer.addChild(gfx); cache.decals.set(d.id, gfx);
            if ((d as any).isCorpse) {
                // Render Corpse
                const color = d.color as number;
                gfx.roundRect(-9, -24, 18, 28, 4).fill(color); // Body
                gfx.circle(0, -4, 10).fill(color).rect(4, -8, 6, 8).fill(0x000000); // Head
            } else {
                // Render Blood/Decal
                gfx.circle(0, 0, 5 + Math.random() * 5).fill({ color: d.color, alpha: 0.7 });
            }
        }
        gfx.position.set(d.pos.x, d.pos.y); gfx.rotation = d.rotation; gfx.alpha = d.alpha;
    });

    // Pickups
    for (const [id, obj] of cache.pickups.entries()) { if (!state.pickups.find(p => p.id === id)) { gameLayer.removeChild(obj); obj.destroy({ children: true, context: true }); cache.pickups.delete(id); } }
    const now = Date.now();
    state.pickups.forEach(p => {
        let obj = cache.pickups.get(p.id);
        if (!obj) { obj = createPickupVisual(p, cache); gameLayer.addChild(obj); cache.pickups.set(p.id, obj); }
        if (p.type === ItemType.FLAG) updateGroundFlagVisual(obj, p, state.platforms, now);
        else updatePickupVisual(obj, p, cache);
    });

    // Corpses: one view per lying corpse, behind the living fighters (cache.corpses is made on first use)
    syncCorpseViews(gameLayer, state.corpses, cache, cache.textures);

    // Players
    const activePlayerIds = new Set(state.players.map(p => p.id));
    for (const [id, container] of cache.players) {
        if (!activePlayerIds.has(id)) { gameLayer.removeChild(container); container.destroy({ children: true, context: true }); cache.players.delete(id); forgetPlayerVisual(id, cache.animator); }
    }
    state.players.forEach(p => {
        if (p.dead) { if (cache.players.has(p.id)) { const c = cache.players.get(p.id); gameLayer.removeChild(c); c.destroy({ children: true, context: true }); cache.players.delete(p.id); forgetPlayerVisual(p.id, cache.animator); } return; }
        let visual = cache.players.get(p.id);
        if (!visual) { visual = createPlayerVisual(p); gameLayer.addChild(visual); cache.players.set(p.id, visual); }
        // cache.animator: a watched match's own animation memory (matchViewCache); the game screen has none, so the page's
        updatePlayerVisual(visual, p, state.camera, toView(mouse, view), view.w, view.h, cache.textures, p.id === localPlayerId, state, undefined, cache.animator);
    });

    // Projectiles: pooled sprites per live id; each shotgun shot leaves one muzzle puff where it was first seen
    cache.projectileView ??= new ProjectileView(gameLayer);
    const newlySeen = cache.projectileView.sync(state.projectiles, Date.now());
    for (const p of firstPelletPerOwner(newlySeen)) createParticles(state, p.pos.x, p.pos.y, 1, '#c8c8c8', 'puff', { size: 5 });

    // Particles: pooled sprites and graphics, one per live particle
    cache.particleView ??= new ParticleView(gameLayer);
    cache.particleView.sync(state.particles);

    // Floating Text
    for (const [id, txt] of cache.floatingTexts.entries()) { if (!state.floatingTexts.find(t => t.id === id)) { gameLayer.removeChild(txt); txt.destroy(); cache.floatingTexts.delete(id); } }
    state.floatingTexts.forEach(t => {
        let txt = cache.floatingTexts.get(t.id);
        if (!txt) { txt = new Text({ text: t.text, style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: t.color, stroke: { color: 0x000000, width: 2 } } }); gameLayer.addChild(txt); cache.floatingTexts.set(t.id, txt); }
        txt.position.set(t.pos.x, t.pos.y); txt.alpha = t.life;
    });

    // Beams (Railgun)
    cache.beamView ??= new BeamView(gameLayer);
    cache.beamView.sync(state.beams ?? []);

    // Smoke clouds, last so they cover everything drawn before; your own fighter in smoke as an outline
    cache.smokeView ??= new SmokeView(gameLayer);
    cache.smokeView.sync(state.smokes ?? [], now, smokeSilhouette(state, state.players.find(pl => pl.id === localPlayerId), now));

    // Cursor
    let cursor = uiLayer.getChildByLabel('cursor') as Graphics;
    if (!cursor) {
        cursor = new Graphics();
        cursor.label = 'cursor';
        cursor.circle(0, 0, 4).fill(0x22c55e);
        uiLayer.addChild(cursor);
    }
    cursor.position.set(mouse.x, mouse.y); // uiLayer is not zoomed: window pixels

    // HUD shows the player this browser controls
    const p = state.players.find(pl => pl.id === localPlayerId);
    if (p) {
        if (setStats) setStats({ hp: hudHealth(p), arm: p.armor, fuel: p.jetpackFuel, maxFuel: p.maxFuel, ammo: p.weapon.ammo, dead: p.dead, respawn: p.respawnTimer - Date.now(), bleeding: !!p.wound });
        if (setPlayerInventory) setPlayerInventory([...p.inventory]);
        if (setActiveWeaponType) setActiveWeaponType(p.weapon.type);
        if (setScores) setScores({ red: state.scores[Team.RED], blue: state.scores[Team.BLUE] });

        // Send player scores for scoreboard
        if (setPlayerScores) {
            const playerScores = state.players.map(pl => ({
                id: pl.id,
                name: pl.name,
                score: pl.score,
                isPlayer: pl.type === 'player',
                isLocal: pl.id === localPlayerId,
                gunLevel: pl.gunLevel,
                gunProgress: pl.gunProgress,
                gunTotalLevels: GUN_GAME_LADDER.length
            })).sort((a, b) => b.score - a.score); // Sort by score descending
            setPlayerScores(playerScores);
        }
    }
};
