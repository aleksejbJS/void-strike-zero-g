import { Application, Container, Graphics, Sprite, Text, Texture, BlurFilter, Filter, GlProgram, Matrix } from 'pixi.js';
// Bloom filter replaced with BlurFilter for glow effect
import { GameState, Platform, Entity, WeaponType, ItemType, Pickup, Team, MapId } from '../../types';
import { WEAPONS_DATA, SKINS, GUN_GAME_LADDER } from '../../constants';

// Performance optimizations
const PARTICLE_POOL_SIZE = 100;
const PROJECTILE_POOL_SIZE = 50;
const particlePool: Graphics[] = [];
const projectilePool: Graphics[] = [];
const colorCache = new Map<string, number>();

const getPooledParticle = (): Graphics => {
    return particlePool.pop() || new Graphics();
};

const returnPooledParticle = (particle: Graphics): void => {
    if (particlePool.length < PARTICLE_POOL_SIZE) {
        particle.clear();
        particlePool.push(particle);
    } else {
        particle.destroy();
    }
};

const getPooledProjectile = (): Graphics => {
    return projectilePool.pop() || new Graphics();
};

const returnPooledProjectile = (projectile: Graphics): void => {
    if (projectilePool.length < PROJECTILE_POOL_SIZE) {
        projectile.clear();
        projectilePool.push(projectile);
    } else {
        projectile.destroy();
    }
};

const getCachedColor = (colorStr: string, fallback: number): number => {
    if (colorCache.has(colorStr)) {
        return colorCache.get(colorStr)!;
    }
    const color = getColor(colorStr, fallback);
    colorCache.set(colorStr, color);
    return color;
};

// Desired visual sizes (largest dimension) for pickup sprites
const PICKUP_DISPLAY_SIZE: Partial<Record<ItemType, number>> = {
    // Unified size for standard pickups (except flags)
    [ItemType.HEALTH]: 54,
    [ItemType.ARMOR]: 54,
    [ItemType.AMMO]: 54,
    [ItemType.FUEL]: 54,
    [ItemType.WEAPON]: 54,
    [ItemType.FLAG]: 170, // flag remains larger
    [ItemType.INTEL]: 64
};

const BENEFICIAL_ITEMS = new Set<ItemType>([
    ItemType.HEALTH,
    ItemType.ARMOR,
    ItemType.AMMO,
    ItemType.FUEL
]);

const getTeamColor = (team: Team) => team === Team.BLUE ? 0x3b82f6 : team === Team.RED ? 0xef4444 : 0xf59e0b;

const darken = (color: number, factor: number) => {
    const r = ((color >> 16) & 0xff) * factor;
    const g = ((color >> 8) & 0xff) * factor;
    const b = (color & 0xff) * factor;
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
};


const createSpritePart = (tex: Texture, label: string, targetSize = 48) => {
    const container = new Container();
    container.label = label;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const baseSize = Math.max(tex.width, tex.height) || 1;
    sprite.scale.set(targetSize / baseSize);
    container.addChild(sprite);
    return container;
};

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
        const shrink = 250 * (hz.pendingCount || 1);
        const minSize = 1200;
        const nx = hz.x + shrink;
        const ny = hz.y + shrink;
        const nw = Math.max(minSize, hz.w - shrink * 2);
        const nh = Math.max(minSize, hz.h - shrink * 2);

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

// Helper to convert hex string to number safely
const getColor = (colorStr: string | undefined, defaultColor: number) => {
    if (!colorStr) return defaultColor;
    if (colorStr.startsWith('#')) return parseInt(colorStr.replace('#', ''), 16);
    return defaultColor;
};

// Create Visuals
// Helper functions to create body parts
const createLeg = (thighColor: number, shinColor: number, label: string) => {
    const leg = new Container();
    leg.label = label;
    const thigh = new Graphics();
    thigh.roundRect(-3, 0, 6, 16, 3).fill(thighColor);
    leg.addChild(thigh);

    const shin = new Container();
    shin.label = 'shin';
    shin.position.set(0, 14);
    const shinGfx = new Graphics();
    shinGfx.roundRect(-2, 0, 4, 18, 2).fill(shinColor);
    shin.addChild(shinGfx);

    const boot = new Graphics();
    boot.rect(-4, 16, 10, 4).fill(0x0f172a);
    shin.addChild(boot);
    leg.addChild(shin);

    return leg;
};

const createArm = (color: number, label: string, hasWeapon: boolean = false, texture?: Texture) => {
    const arm = texture ? createSpritePart(texture, label, 32) : new Container();
    if (!texture) {
        arm.label = label;
        const upperArm = new Graphics();
        upperArm.roundRect(-3, -2, 18, 6, 3).fill(color);
        arm.addChild(upperArm);
    }

    if (hasWeapon) {
        const wGfx = new Graphics();
        wGfx.label = 'weapon';
        wGfx.position.set(14, 0);
        arm.addChild(wGfx);
    }

    return arm;
};

const createHead = (color: number, texture?: Texture, style: string = 'human', accent?: number) => {
    if (texture) return createSpritePart(texture, 'head', 28);
    const head = new Container();
    head.label = 'head';

    const headGfx = new Graphics();
    if (style === 'robot') {
        headGfx.roundRect(-10, -12, 20, 16, 3).fill(color);
        headGfx.rect(-8, -8, 16, 8).fill(accent ?? 0xe5e7eb);
        headGfx.rect(-2, -18, 4, 6).fill(accent ?? 0xe5e7eb);
    } else {
        headGfx.circle(0, -4, 10).fill(color);
        headGfx.rect(4, -8, 6, 8).fill(0x000000);
        headGfx.rect(2, 0, 10, 4).fill(0x333333);
        if (style === 'beast' || style === 'alien') {
            const accentColor = accent ?? 0xe5e7eb;
            headGfx.moveTo(-10, -8).lineTo(-4, -18).lineTo(0, -8).fill(color);
            headGfx.moveTo(10, -8).lineTo(4, -18).lineTo(0, -8).fill(color);
            headGfx.circle(-4, -10, 2).fill(accentColor);
            headGfx.circle(4, -10, 2).fill(accentColor);
        }
    }
    head.addChild(headGfx);

    return head;
};

const createTorso = (color: number, texture?: Texture, style: string = 'human', accent?: number) => {
    if (texture) return createSpritePart(texture, 'body', 36);
    const torso = new Graphics();
    torso.label = 'body';
    torso.roundRect(-9, -24, 18, 28, 4).fill(color);
    if (style === 'robot') {
        const accentColor = accent ?? 0xe5e7eb;
        torso.rect(-10, -8, 20, 10).fill(accentColor);
        torso.rect(-6, -20, 12, 6).fill(0x0f172a);
    }
    return torso;
};

const createJetpack = (color: number, texture?: Texture) => {
    if (texture) return createSpritePart(texture, 'jetpack', 26);
    const jetpack = new Graphics();
    jetpack.label = 'jetpack';
    jetpack.rect(-16, -10, 8, 20).fill(color);
    return jetpack;
};

const createPlayerVisual = (p: Entity, cache: any) => {
    const c = new Container();
    c.label = p.id;
    c.sortableChildren = true;

    const torsoColor = getCachedColor(p.torsoColor || p.color, 0xffffff);
    const headColor = getCachedColor(p.headColor || p.color, torsoColor);
    const armColor = getCachedColor(p.armColor || p.color, torsoColor);
    const legColor = getCachedColor(p.legColor || '#475569', 0x475569);
    const jetpackColor = getCachedColor(p.jetpackColor, 0xfbbf24);
    const skin = SKINS.find(s => s.id === p.skinId);
    const style = skin?.style || 'human';
    const accentColor = getCachedColor(skin?.accent || '#e5e7eb', 0xe5e7eb);

    // Create body parts in render order (back to front)
    const headTex = cache.textures['skin_head'];
    const bodyTex = cache.textures['skin_body'];
    const jetpackTex = cache.textures['skin_jetpack'];
    const armTex = cache.textures['skin_arm'];

    const backLeg = createLeg(legColor, darken(legColor, 0.7), 'backLeg');
    backLeg.zIndex = 1;
    c.addChild(backLeg);

    if (style === 'beast' || style === 'alien') {
        const tail = new Graphics();
        tail.label = 'tail';
        tail.roundRect(-18, -2, 14, 4, 2).fill(accentColor);
        tail.pivot.set(7, 0);
        tail.position.set(-14, 6);
        tail.zIndex = 1.5;
        c.addChild(tail);
    }

    const jetpack = createJetpack(jetpackColor, jetpackTex);
    jetpack.zIndex = 2;
    c.addChild(jetpack);

    const leftArm = createArm(armColor, 'leftArm', false, armTex);
    leftArm.position.set(-8, -20);
    leftArm.zIndex = 3;
    c.addChild(leftArm);

    const torso = createTorso(torsoColor, bodyTex, style, accentColor);
    torso.zIndex = 4;
    c.addChild(torso);

    const head = createHead(headColor, headTex, style, accentColor);
    head.position.set(0, -24);
    head.zIndex = 5;
    c.addChild(head);

    const frontLeg = createLeg(legColor, darken(legColor, 0.7), 'frontLeg');
    frontLeg.zIndex = 6;
    c.addChild(frontLeg);

    const rightArm = createArm(armColor, 'rightArm', true, armTex);
    rightArm.position.set(0, -20);
    rightArm.zIndex = 7;
    c.addChild(rightArm);

    const flame = new Graphics();
    flame.label = 'flame';
    flame.visible = false;
    flame.zIndex = 0;
    c.addChild(flame);

    return c;
};

const updatePlayerVisual = (c: Container, p: Entity, camera: { x: number, y: number }, mouse: { x: number, y: number }, screenW: number, screenH: number, cache: any) => {
    if (!c) return;

    // Hide player sprite if dead (we have a corpse decal now)
    // Show and reset alpha if alive
    c.visible = !p.dead;
    if (!p.dead) c.alpha = 1;

    if (p.dead) return; // Don't update visuals if dead/hidden

    c.position.set(p.pos.x, p.pos.y);

    const backLeg = c.getChildByLabel('backLeg') as Container;
    const frontLeg = c.getChildByLabel('frontLeg') as Container;
    const head = c.getChildByLabel('head') as Container;
    const rightArm = c.getChildByLabel('rightArm') as Container;
    const leftArm = c.getChildByLabel('leftArm') as Container;
    const wGfx = rightArm?.getChildByLabel('weapon') as Graphics;
    const flame = c.getChildByLabel('flame') as Graphics;
    const backShin = backLeg?.getChildByLabel('shin') as Container;
    const frontShin = frontLeg?.getChildByLabel('shin') as Container;
    const jetpackVisual = c.getChildByLabel('jetpack');
    const body = c.getChildByLabel('body') as Graphics;
    const tail = c.getChildByLabel('tail') as Graphics;
    const skin = SKINS.find(s => s.id === p.skinId);
    const style = skin?.style || 'human';

    if (!backLeg || !frontLeg || !head || !rightArm) return;

    const crouchOffset = p.isCrouching ? 12 : 0;
    c.pivot.y = 34 - crouchOffset;

    if (p.isCrouching) {
        body.position.y = 10;
        head.position.y = -14;
        rightArm.position.y = -10;
        if (leftArm) leftArm.position.y = -10;
        if (jetpackVisual) jetpackVisual.position.y = 0;
    } else {
        body.position.y = 0;
        head.position.y = -24;
        rightArm.position.y = -20;
        if (leftArm) leftArm.position.y = -20;
        if (jetpackVisual) jetpackVisual.position.y = -10;
    }

    let aim = 0;
    if (p.type === 'player') {
        const cx = screenW / 2;
        const cy = screenH / 2;
        const shoulderWorldY = p.pos.y - 50 + crouchOffset;
        const shoulderScreenX = (p.pos.x - camera.x) + cx;
        const shoulderScreenY = (shoulderWorldY - camera.y) + cy;
        aim = Math.atan2(mouse.y - shoulderScreenY, mouse.x - shoulderScreenX);
    } else {
        aim = Math.atan2(p.vel.y, p.facingRight ? 100 : -100);
    }

    const facing = Math.abs(aim) > Math.PI / 2 ? -1 : 1;
    c.scale.x = facing;

    let localAim = aim;
    if (facing === -1) localAim = Math.PI - aim;
    while (localAim > Math.PI) localAim -= Math.PI * 2;
    while (localAim < -Math.PI) localAim += Math.PI * 2;

    // Right arm (weapon arm) follows aim
    rightArm.rotation = localAim;

    // Left arm has subtle animation
    if (leftArm) {
        if (Math.abs(p.vel.x) > 0.5) {
            // Swing arm while running
            const time = Date.now() * 0.012;
            leftArm.rotation = Math.sin(time) * 0.4;
        } else {
            // Slight angle when idle
            leftArm.rotation = localAim * 0.3;
        }
    }

    head.rotation = Math.max(-0.5, Math.min(0.5, localAim * 0.5));



    const isFlying = !p.isGrounded && p.vel.y < 0;
    if (isFlying) {
        frontLeg.rotation = 0.2 * facing; backLeg.rotation = 0.1 * facing;
        frontShin.rotation = 0.5; backShin.rotation = 0.2;
        flame.visible = true; flame.clear();
        flame.moveTo(-15, 6).lineTo(-12, 18 + Math.random() * 6).lineTo(-9, 6).fill(0xfbbf24);
        if (tail) tail.rotation = -0.4 * facing;
    } else if (Math.abs(p.vel.x) > 0.5) {
        const time = Date.now() * 0.015;
        frontLeg.rotation = Math.sin(time) * 0.8; backLeg.rotation = Math.sin(time + Math.PI) * 0.8;
        frontShin.rotation = Math.max(0, Math.sin(time - 1) * 1.5); backShin.rotation = Math.max(0, Math.sin(time + Math.PI - 1) * 1.5);
        flame.visible = false;
        if (tail) tail.rotation = Math.sin(time) * 0.3 * facing;
    } else if (p.isCrouching) {
        frontLeg.rotation = -0.5; backLeg.rotation = 0.5;
        frontShin.rotation = 1.0; backShin.rotation = 1.0;
        flame.visible = false;
        if (tail) tail.rotation = -0.2 * facing;
    } else {
        frontLeg.rotation = 0; backLeg.rotation = 0; frontShin.rotation = 0; backShin.rotation = 0; flame.visible = false;
        if (tail) tail.rotation = Math.max(-0.4, Math.min(0.4, p.vel.x * 0.03)) * facing;
    }

    wGfx.removeChildren(); // Clear previous graphics/sprites

    // Check if we have a texture for this weapon
    const weaponType = p.weapon.type;
    const key = `weapon_${weaponType.toLowerCase().replace(' ', '_')}`;
    const texture = cache.textures[key];

    if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.2, 0.5); // Anchor near the handle/back

        // Scale adjustment
        const baseScale = getPickupSpriteScale(weaponType as any, texture);
        let scale = baseScale;

        // Specific adjustments for held weapons
        if (weaponType === WeaponType.SHOTGUN) scale *= 1.6;
        else if (weaponType === WeaponType.ROCKET_LAUNCHER) scale *= 1.6;
        else if (weaponType === WeaponType.RAILGUN) scale *= 1.5;
        else if (weaponType === WeaponType.MACHINE_GUN) scale *= 1.5;
        else if (weaponType === WeaponType.CHAINSAW) scale *= 1.4;

        sprite.scale.set(scale);

        // Flip sprite if facing left? No, the container 'arm' is rotated.
        // But we might need to flip Y if the arm rotation is > 90 degrees?
        // Actually, the arm rotation logic (lines 118-125) handles the arm angle.
        // However, if the player is facing left (scale.x = -1), the arm is flipped.
        // Let's trust the existing arm rotation logic for now.

        wGfx.addChild(sprite);
    } else {
        // Fallback to geometric shapes if texture missing
        wGfx.clear();
        const weaponColor = WEAPONS_DATA[p.weapon.type].color;
        const type = p.weapon.type;
        if (type === WeaponType.ROCKET_LAUNCHER) {
            wGfx.rect(-10, -6, 34, 10).fill(0x57534e); wGfx.rect(10, -6, 14, 10).fill(weaponColor);
        } else {
            wGfx.rect(0, -4, 16, 8).fill(0x1e293b); wGfx.rect(16, -2, 10, 4).fill(0x94a3b8); wGfx.rect(2, -2, 12, 2).fill(weaponColor);
        }
    }



    // Grappling Hook Rope/Chain Visualization
    const existingRope = c.getChildByLabel('grappleRope') as Graphics;
    if (p.grapple.active) {
        let rope = existingRope;
        if (!rope) {
            rope = new Graphics();
            rope.label = 'grappleRope';
            c.addChildAt(rope, 0); // Add behind player
        }
        rope.clear();

        // Calculate rope attachment point on player (shoulder area)
        const shoulderOffsetY = p.isCrouching ? -10 : -20;
        const shoulderOffsetX = 0;

        // Rope endpoints (relative to player container)
        const startX = shoulderOffsetX;
        const startY = shoulderOffsetY;
        const endX = p.grapple.pos.x - p.pos.x;
        const endY = p.grapple.pos.y - p.pos.y;

        // Draw animated chain segments
        const distance = Math.sqrt(endX * endX + endY * endY);
        const segments = Math.max(8, Math.floor(distance / 20)); // One segment every 20 pixels
        const time = Date.now() * 0.003;

        // Main rope line with glow
        rope.moveTo(startX, startY)
            .lineTo(endX, endY)
            .stroke({ width: 3, color: 0x94a3b8, alpha: 0.8 });

        // Glow effect
        rope.moveTo(startX, startY)
            .lineTo(endX, endY)
            .stroke({ width: 6, color: 0x60a5fa, alpha: 0.3 });

        // Draw chain segments
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;

            // Add slight wave effect for realism
            const wave = Math.sin(time + i * 0.5) * 2;
            const perpX = -(endY - startY) / distance;
            const perpY = (endX - startX) / distance;

            const segX = x + perpX * wave;
            const segY = y + perpY * wave;

            // Chain link segments
            const size = 2 + Math.sin(time * 2 + i) * 0.5;
            rope.circle(segX, segY, size).fill({ color: 0xe2e8f0, alpha: 0.9 });
            rope.circle(segX, segY, size + 1).stroke({ width: 1, color: 0x64748b, alpha: 0.6 });
        }

        // Grapple hook at the end
        const hookSize = 6;
        rope.circle(endX, endY, hookSize).fill(0x475569);
        rope.circle(endX, endY, hookSize - 2).fill(0x94a3b8);

        // Hook glow
        const pulse = 1 + Math.sin(time * 3) * 0.2;
        rope.circle(endX, endY, hookSize * pulse * 1.5)
            .fill({ color: 0x60a5fa, alpha: 0.3 });

    } else if (existingRope) {
        // Remove rope when grapple is not active
        c.removeChild(existingRope);
        existingRope.destroy();
    }

    const existingFlag = c.getChildByLabel('carriedFlag') as Container;
    const flagGlow = c.getChildByLabel('flagGlow') as Graphics;
    let flagFire = c.getChildByLabel('flagFire') as Graphics;
    if (p.hasFlag !== Team.NONE) {
        const isHTFCarrier = p.hasFlag === p.team;
        const isIntelCarrier = p.hasFlag === Team.RED && p.team === Team.BLUE;
        const color = isHTFCarrier ? 0xf97316 : isIntelCarrier ? 0xfacc15 : p.hasFlag === Team.BLUE ? 0x3b82f6 : 0xef4444;
        if (!flagGlow) { const glow = new Graphics(); glow.label = 'flagGlow'; glow.position.set(0, -20); c.addChildAt(glow, 0); }
        else { flagGlow.clear(); const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1; flagGlow.circle(0, 0, 45 * pulse).fill({ color, alpha: 0.25 }); flagGlow.circle(0, 0, 35 * pulse).fill({ color, alpha: 0.2 }); }
        let f = existingFlag;
        if (!f) { f = new Container(); f.label = 'carriedFlag'; c.addChildAt(f, 2); const pole = new Graphics(); pole.moveTo(0, 0).lineTo(0, -60).stroke({ width: 4, color: 0xffffff }); f.addChild(pole); const cloth = new Graphics(); cloth.label = 'cloth'; f.addChild(cloth); }
        const cloth = f.getChildByLabel('cloth') as Graphics;
        cloth.clear(); const wave = Math.sin(Date.now() * 0.015) * 5; cloth.poly([0, -60, 35, -50 + wave, 35, -20 + wave, 0, -30]).fill(color);
        f.position.set(-10, -40 + crouchOffset); f.rotation = -0.1 + (p.vel.x * -0.02 * facing);

        if (isHTFCarrier) {
            if (!flagFire) { flagFire = new Graphics(); flagFire.label = 'flagFire'; c.addChildAt(flagFire, 1); }
            flagFire.clear();
            for (let i = 0; i < 6; i++) {
                const jitterX = (Math.random() - 0.5) * 20;
                const jitterY = -30 - Math.random() * 10;
                flagFire.circle(jitterX, jitterY, 3 + Math.random() * 2).fill({ color: 0xfbbf24, alpha: 0.9 });
            }
            flagFire.alpha = 0.9;
        } else if (flagFire) {
            c.removeChild(flagFire); flagFire.destroy();
        }
    } else {
        if (existingFlag) { c.removeChild(existingFlag); existingFlag.destroy({ children: true }); }
        if (flagGlow) { c.removeChild(flagGlow); flagGlow.destroy(); }
        if (flagFire) { c.removeChild(flagFire); flagFire.destroy(); }
    }
};

const getWeaponTexture = (item: Pickup, cache: any, fallback?: Texture) => {
    if (item.type !== ItemType.WEAPON || !item.subtype) return fallback;
    const key = `weapon_${item.subtype.toLowerCase?.() ?? String(item.subtype).toLowerCase()}`;
    return cache.textures[key] || fallback;
};

const createPickupVisual = (item: Pickup, cache: any) => {
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
        if (item.type === ItemType.FLAG) {
            const teamKey = item.team === Team.BLUE ? 'flag_blue' : item.team === Team.RED ? 'flag_red' : undefined;
            const flagTex = (teamKey && cache.textures[teamKey]) || cache.textures[ItemType.FLAG] || texture;
            const sprite = new Sprite(flagTex);
            sprite.anchor.set(0.5);
            sprite.scale.set(scale);
            sprite.label = 'sprite';
            c.addChild(sprite);
        } else {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.scale.set(scale);
            sprite.label = 'sprite';
            c.addChild(sprite);
        }
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
        if (item.type === ItemType.FLAG) {
            const color = getTeamColor(item.team ?? Team.NONE);
            const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.08;
            const baseSize = (PICKUP_DISPLAY_SIZE[item.type] ?? 64) * 0.6; // slightly smaller halo
            const r = (baseSize * pulse) / 2;
            halo.visible = true;
            halo.circle(0, 0, r + 4).stroke({ width: 2, color, alpha: 0.35 });
            halo.circle(0, 0, r).fill({ color, alpha: 0.15 });
        } else if (item.type === ItemType.INTEL) {
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
        if (item.type === ItemType.FLAG) {
            const teamKey = item.team === Team.BLUE ? 'flag_blue' : item.team === Team.RED ? 'flag_red' : undefined;
            const tex = (teamKey && (cache as any).textures[teamKey]) || (cache as any).textures[ItemType.FLAG];
            if (tex && sprite.texture !== tex) sprite.texture = tex;
            sprite.tint = item.team === Team.NONE ? 0xfbbf24 : 0xffffff;
        } else if (item.type === ItemType.WEAPON) {
            sprite.tint = 0xffffff;
        }
        return;
    }
    const g = c.getChildByLabel('g') as Graphics; if (!g) return;
    g.clear();

    if (item.type === ItemType.FLAG) {
        const color = item.team === Team.BLUE ? 0x3b82f6 : item.team === Team.RED ? 0xef4444 : 0xf59e0b;
        // Flag with better visibility
        g.rect(-2, -25, 4, 50).fill(0x94a3b8);
        g.poly([0, -25, 25, -18, 20, -5, 25, 5, 0, 0]).fill(color);
        // Add glow for flags
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.2;
        g.circle(0, -10, 35 * pulse).fill({ color, alpha: 0.15 });
    } else if (item.type === ItemType.WEAPON && item.subtype) {
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

export const syncVisuals = (app: Application, world: Container, gameLayer: Container, decalLayer: Container, uiLayer: Container, state: GameState, cache: any, shakeRef: any, mouse: { x: number, y: number }, setStats: any, setPlayerInventory: any, setActiveWeaponType: any, setScores: any, setPlayerScores?: any) => {
    let shakeX = (Math.random() - 0.5) * shakeRef.current;
    let shakeY = (Math.random() - 0.5) * shakeRef.current;
    // Apply filters
    world.filters = null;
    shakeRef.current *= 0.9;

    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;
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
    for (const [id, obj] of cache.pickups.entries()) { if (!state.pickups.find(p => p.id === id)) { gameLayer.removeChild(obj); obj.destroy(); cache.pickups.delete(id); } }
    state.pickups.forEach(p => {
        let obj = cache.pickups.get(p.id);
        if (!obj) { obj = createPickupVisual(p, cache); gameLayer.addChild(obj); cache.pickups.set(p.id, obj); }
        updatePickupVisual(obj, p, cache);
    });

    // Players
    const activePlayerIds = new Set(state.players.map(p => p.id));
    for (const [id, container] of cache.players) {
        if (!activePlayerIds.has(id)) { gameLayer.removeChild(container); container.destroy({ children: true }); cache.players.delete(id); }
    }
    state.players.forEach(p => {
        if (p.dead) { if (cache.players.has(p.id)) { const c = cache.players.get(p.id); gameLayer.removeChild(c); c.destroy({ children: true }); cache.players.delete(p.id); } return; }
        let visual = cache.players.get(p.id);
        if (!visual) { visual = createPlayerVisual(p, cache); gameLayer.addChild(visual); cache.players.set(p.id, visual); }
        updatePlayerVisual(visual, p, state.camera, mouse, app.screen.width, app.screen.height, cache);
    });

    // Projectiles - Optimized with object pooling
    for (const [id, gfx] of cache.projectiles.entries()) {
        if (!state.projectiles.find(p => p.id === id)) {
            gameLayer.removeChild(gfx);
            returnPooledProjectile(gfx);
            cache.projectiles.delete(id);
        }
    }
    state.projectiles.forEach(p => {
        let gfx = cache.projectiles.get(p.id);
        if (!gfx) {
            gfx = getPooledProjectile();
            gameLayer.addChild(gfx);
            cache.projectiles.set(p.id, gfx);
        }
        gfx.clear(); gfx.position.set(p.pos.x, p.pos.y); gfx.rotation = Math.atan2(p.vel.y, p.vel.x);

        if (p.type === WeaponType.RAILGUN) {
            // Blue rail beam instead of a bullet
            const beamLength = 30;
            const beamWidth = 4;
            const color = 0x60a5fa;
            gfx.rect(-beamLength / 2, -beamWidth / 2, beamLength, beamWidth).fill(color);
            gfx.rect(-beamLength / 2, -beamWidth, beamLength, beamWidth).fill({ color, alpha: 0.4 });
        } else if (p.type === WeaponType.PLASMA_GUN) {
            // Plasma: Bright core + glow
            gfx.circle(0, 0, p.radius + 4).fill({ color: 0x60a5fa, alpha: 0.3 }); // Outer glow (blue-400)
            gfx.circle(0, 0, p.radius + 2).fill({ color: 0x3b82f6, alpha: 0.5 }); // Inner glow (blue-500)
            gfx.circle(0, 0, p.radius).fill(0xffffff); // Bright white core
        } else {
            gfx.circle(0, 0, p.radius).fill(WEAPONS_DATA[p.type].color);
        }
    });

    // Particles - Optimized with object pooling
    for (const [id, gfx] of cache.particles.entries()) {
        if (!state.particles.find(p => p.id === id)) {
            gameLayer.removeChild(gfx);
            returnPooledParticle(gfx);
            cache.particles.delete(id);
        }
    }
    state.particles.forEach(p => {
        let gfx = cache.particles.get(p.id);
        if (!gfx) {
            gfx = getPooledParticle();
            gameLayer.addChild(gfx);
            cache.particles.set(p.id, gfx);
        }
        gfx.clear(); gfx.alpha = p.life;
        if (p.type === 'shell') { gfx.rect(-2, -1, 4, 2).fill(0xfbbf24); gfx.rotation = p.rotation || 0; }
        else { gfx.rect(0, 0, p.size, p.size).fill(p.color); }
        gfx.position.set(p.pos.x, p.pos.y);
    });

    // Floating Text
    for (const [id, txt] of cache.floatingTexts.entries()) { if (!state.floatingTexts.find(t => t.id === id)) { gameLayer.removeChild(txt); txt.destroy(); cache.floatingTexts.delete(id); } }
    state.floatingTexts.forEach(t => {
        let txt = cache.floatingTexts.get(t.id);
        if (!txt) { txt = new Text({ text: t.text, style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: t.color, stroke: { color: 0x000000, width: 2 } } }); gameLayer.addChild(txt); cache.floatingTexts.set(t.id, txt); }
        txt.position.set(t.pos.x, t.pos.y); txt.alpha = t.life;
    });

    // Beams (Railgun)
    if (state.beams) {
        for (const [id, gfx] of cache.beams.entries()) { if (!state.beams.find(b => b.id === id)) { gameLayer.removeChild(gfx); gfx.destroy(); cache.beams.delete(id); } }
        state.beams.forEach(b => {
            let gfx = cache.beams.get(b.id);
            if (!gfx) { gfx = new Graphics(); gameLayer.addChild(gfx); cache.beams.set(b.id, gfx); }
            gfx.clear();

            // Draw Beam
            gfx.moveTo(b.start.x, b.start.y);
            gfx.lineTo(b.end.x, b.end.y);
            gfx.stroke({ width: b.width, color: b.color, alpha: b.life });

            // Glow
            gfx.moveTo(b.start.x, b.start.y);
            gfx.lineTo(b.end.x, b.end.y);
            gfx.stroke({ width: b.width * 3, color: b.color, alpha: b.life * 0.4 });
        });
    }

    // Cursor
    let cursor = uiLayer.getChildByLabel('cursor') as Graphics;
    if (!cursor) {
        cursor = new Graphics();
        cursor.label = 'cursor';
        cursor.circle(0, 0, 4).fill(0x22c55e);
        uiLayer.addChild(cursor);
    }
    cursor.position.set(mouse.x, mouse.y);

    // Ragdoll Parts
    if (!cache.ragdollParts) cache.ragdollParts = new Map();
    const activeRagdollIds = new Set(state.ragdollParts.map(r => r.id));
    for (const [id, gfx] of cache.ragdollParts.entries()) {
        if (!activeRagdollIds.has(id)) {
            gameLayer.removeChild(gfx);
            gfx.destroy();
            cache.ragdollParts.delete(id);
        }
    }

    state.ragdollParts.forEach(part => {
        let gfx = cache.ragdollParts.get(part.id);
        if (!gfx) {
            gfx = new Graphics();
            gameLayer.addChild(gfx);
            cache.ragdollParts.set(part.id, gfx);
        }

        gfx.clear();
        gfx.position.set(part.pos.x, part.pos.y);
        gfx.rotation = part.rotation;
        gfx.alpha = Math.min(1, part.life / 2); // Fade out in last 2 seconds

        const color = part.color === '#3b82f6' ? 0x3b82f6 :
            part.color === '#ef4444' ? 0xef4444 :
                part.color === '#22c55e' ? 0x22c55e :
                    part.color === '#eab308' ? 0xeab308 : 0xffffff;

        // Draw different shapes for different body parts
        switch (part.type) {
            case 'head':
                gfx.circle(0, 0, 8).fill(color);
                gfx.circle(-2, -2, 2).fill(0x000000); // Eye
                gfx.circle(2, -2, 2).fill(0x000000); // Eye
                break;
            case 'torso':
                gfx.roundRect(-10, -15, 20, 30, 4).fill(color);
                break;
            case 'arm-left':
            case 'arm-right':
                gfx.roundRect(-3, -12, 6, 24, 2).fill(color);
                break;
            case 'leg-left':
            case 'leg-right':
                gfx.roundRect(-4, -15, 8, 30, 3).fill(color);
                break;
        }
    });

    if (state.players[0]) {
        const p = state.players[0];
        if (setStats) setStats({ hp: Math.round(p.health), arm: p.armor, fuel: p.jetpackFuel, ammo: p.weapon.ammo, dead: p.dead, respawn: p.respawnTimer - Date.now() });
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
                gunLevel: pl.gunLevel,
                gunProgress: pl.gunProgress,
                gunTotalLevels: GUN_GAME_LADDER.length
            })).sort((a, b) => b.score - a.score); // Sort by score descending
            setPlayerScores(playerScores);
        }
    }
};
