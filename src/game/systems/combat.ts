// Combat system — damage, weapons, explosions, ragdolls, particles
// Extracted from physics.ts for better modularity

import { GameState, Entity, Platform, Vector2, WeaponType, ItemType, GameMode, Team, RagdollPart } from '../../types';
import { GRAVITY, WEAPONS_DATA, RESPAWN_DELAY, SELF_DAMAGE_MULT, SELF_KNOCKBACK_MULT, KNOCKBACK_AIR_MULT } from '../../constants';
import { gameEvents } from './events';
import { nextId } from '../utils/id';
import { distance, normalize, checkPointInRect, segmentIntersectsRect } from '../utils/math';
import { resetFlagToBase, handleGunGameKill, handleGunGameDeath } from './gamemodes';
import { trackKill } from './achievements';

// --- Ragdoll ---

export const createRagdoll = (state: GameState, entity: Entity) => {
    const randomForce = () => (Math.random() - 0.5) * 10;
    const baseColor = entity.color;
    const parts: RagdollPart[] = [
        {
            id: nextId('rag_'), type: 'head',
            pos: { x: entity.pos.x, y: entity.pos.y - entity.height + 5 },
            vel: { x: randomForce(), y: -Math.random() * 8 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.3,
            life: 5, color: baseColor, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'torso',
            pos: { x: entity.pos.x, y: entity.pos.y - entity.height / 2 },
            vel: { x: randomForce() * 0.5, y: -Math.random() * 5 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.2,
            life: 5, color: baseColor, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-left',
            pos: { x: entity.pos.x - 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: -Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: baseColor, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-right',
            pos: { x: entity.pos.x + 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: baseColor, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-left',
            pos: { x: entity.pos.x - 5, y: entity.pos.y - 10 },
            vel: { x: -Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: baseColor, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-right',
            pos: { x: entity.pos.x + 5, y: entity.pos.y - 10 },
            vel: { x: Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: baseColor, isGrounded: false
        }
    ];

    state.ragdollParts.push(...parts);
};

// --- Particles ---

export const createParticles = (state: GameState, x: number, y: number, count: number, color: string, type: 'blood' | 'spark' | 'smoke' | 'fire' | 'shell' = 'spark') => {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            id: nextId('pt_'),
            pos: { x, y },
            vel: {
                x: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10),
                y: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10)
            },
            life: 1.0,
            decay: 0.02 + Math.random() * 0.03,
            color,
            size: type === 'smoke' ? 5 + Math.random() * 10 : (type === 'shell' ? 3 : 2 + Math.random() * 2),
            type,
            rotation: Math.random() * Math.PI * 2
        });
    }
};

// --- Raycasting ---

export const castRay = (state: GameState, start: Vector2, dir: Vector2, range: number): Vector2 | null => {
    let c = { x: start.x, y: start.y }, d = 0;
    while (d < range) { c.x += dir.x * 10; c.y += dir.y * 10; d += 10; for (const p of state.platforms) if (checkPointInRect(c, p)) return { ...c }; }
    return null;
};

// --- Platform Collision ---

export const resolveCollision = (p: Entity, plat: Platform) => {
    const pLeft = p.pos.x - p.width / 2;
    const pRight = p.pos.x + p.width / 2;
    const pTop = p.pos.y - p.height;
    const pBottom = p.pos.y;

    if (pRight > plat.x && pLeft < plat.x + plat.w && pBottom > plat.y && pTop < plat.y + plat.h) {
        const overlapL = pRight - plat.x;
        const overlapR = (plat.x + plat.w) - pLeft;
        const overlapT = pBottom - plat.y;
        const overlapB = (plat.y + plat.h) - pTop;

        const min = Math.min(overlapL, overlapR, overlapT, overlapB);

        if (min === overlapT && p.vel.y >= 0) {
            p.pos.y = plat.y; p.vel.y = 0; p.isGrounded = true;
        } else if (min === overlapB && p.vel.y < 0) {
            p.pos.y = plat.y + plat.h + p.height; p.vel.y = 0;
        } else if (min === overlapL) {
            p.pos.x = plat.x - p.width / 2; p.vel.x = 0;
        } else if (min === overlapR) {
            p.pos.x = plat.x + plat.w + p.width / 2; p.vel.x = 0;
        }
    }
};

// --- Damage ---

export const applyDamage = (state: GameState, target: Entity, attackerId: string, amount: number, knockback: Vector2, knockbackForce = 0) => {
    if (target.dead) return;

    // Self-damage multiplier (rocket-jump)
    const isSelf = attackerId === target.id;
    const dmgMult = isSelf ? SELF_DAMAGE_MULT : 1;
    const kbMult = isSelf ? SELF_KNOCKBACK_MULT : 1;

    const holdingHTF = state.mode === GameMode.HOLD_THE_FLAG && target.hasFlag === target.team;
    let dmg = (holdingHTF ? amount * 1.1 : amount) * dmgMult;
    if (target.armor > 0) {
        const absorb = Math.min(target.armor, dmg * 0.66);
        target.armor -= absorb;
        dmg -= absorb;
    }
    target.health -= dmg;

    // Directional knockback using weapon's knockbackForce
    const len = Math.sqrt(knockback.x * knockback.x + knockback.y * knockback.y) || 1;
    const airMult = target.isGrounded ? 1 : KNOCKBACK_AIR_MULT;
    const force = (knockbackForce || amount / 10) * kbMult * airMult;
    target.vel.x += (knockback.x / len) * force;
    target.vel.y += (knockback.y / len) * force;

    state.floatingTexts.push({
        id: nextId('ft_'), pos: { ...target.pos, y: target.pos.y - 40 },
        text: Math.round(dmg).toString(), color: '#ef4444', life: 1, velY: 1
    });

    if (target.health <= 0) {
        target.dead = true;
        target.respawnTimer = state.mode === GameMode.HUNGER_GAMES ? Number.MAX_SAFE_INTEGER : (Date.now() + RESPAWN_DELAY);
        createParticles(state, target.pos.x, target.pos.y, 40, target.color, 'blood');
        // Decal (Blood)
        state.decals.push({
            id: nextId('dc_'), pos: { x: target.pos.x, y: target.pos.y + 20 },
            rotation: Math.random() * Math.PI * 2, scale: 1 + Math.random(), color: 0x7f1d1d, alpha: 0.8
        });

        // Create Ragdoll instead of static corpse
        createRagdoll(state, target);

        // Hunger Games: shrink zone on each death
        if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone) {
            const shrink = 250;
            const minSize = 1200;
            if (!state.hungerZone.pendingShrink) {
                state.hungerZone.pendingShrink = true;
                state.hungerZone.nextShrinkAt = Date.now() + 5000;
                state.hungerZone.pendingCount = 1;
            } else {
                state.hungerZone.pendingCount = (state.hungerZone.pendingCount || 1) + 1;
            }
            const doShrink = state.hungerZone.pendingShrink && state.hungerZone.nextShrinkAt && Date.now() >= state.hungerZone.nextShrinkAt;
            if (doShrink) {
                const stack = Math.max(1, state.hungerZone.pendingCount || 1);
                const totalShrink = shrink * stack;
                state.hungerZone.x += totalShrink;
                state.hungerZone.y += totalShrink;
                state.hungerZone.w = Math.max(minSize, state.hungerZone.w - totalShrink * 2);
                state.hungerZone.h = Math.max(minSize, state.hungerZone.h - totalShrink * 2);
                state.hungerZone.lastShrink = Date.now();
                state.hungerZone.pendingShrink = false;
                state.hungerZone.nextShrinkAt = undefined;
                state.hungerZone.pendingCount = 0;
            }
        }

        if (state.mode === GameMode.GUN_GAME) {
            handleGunGameDeath(target);
        }

        // Если игрок нес флаг — вернуть его на базу команды флага или дропнуть
        if (target.hasFlag !== Team.NONE) {
            if (state.mode === GameMode.HOLD_THE_FLAG && target.hasFlag === target.team) {
                const dropId = nextId('htf_drop_');
                state.pickups.push({
                    id: dropId,
                    type: ItemType.FLAG,
                    team: Team.NONE,
                    pos: { x: target.pos.x + (Math.random() - 0.5) * 20, y: target.pos.y },
                    active: true,
                    respawnTime: 0,
                    value: 0
                });
            } else if (state.mode === GameMode.INFILTRATION && target.hasFlag === Team.RED) {
                state.pickups.push({
                    id: nextId('intel_drop_'),
                    type: ItemType.INTEL,
                    team: Team.RED,
                    pos: { x: target.pos.x, y: target.pos.y },
                    active: true,
                    respawnTime: -1,
                    value: 1000
                });
            } else {
                resetFlagToBase(state, target.hasFlag);
            }
            target.hasFlag = Team.NONE;
        }

        if (attackerId) {
            const killer = state.players.find(p => p.id === attackerId);
            gameEvents.emit({
                type: 'KILL',
                killer: killer ? killer.name : 'World',
                killerColor: killer ? killer.color : '#ffffff',
                weapon: killer ? killer.weapon.name : 'Environment',
                victim: target.name,
                victimColor: target.color
            });
            // Award score
            if (killer) {
                if (state.mode !== GameMode.CTF) {
                    killer.score++;
                } else if (killer.team !== target.team) {
                    killer.score += 100;
                }

                if (state.mode === GameMode.GUN_GAME) {
                    handleGunGameKill(state, killer);
                }

                // Track achievement only for player-controlled kills
                if (killer.type === 'player') {
                    trackKill(killer.weapon.type);
                }
            }
        }
    }
};

// --- Explosions ---

export const createExplosion = (state: GameState, pos: Vector2, ownerId: string, radius: number, weaponType?: WeaponType) => {
    createParticles(state, pos.x, pos.y, 20, '#f97316', 'fire');
    createParticles(state, pos.x, pos.y, 10, '#ffffff', 'smoke');
    gameEvents.emit({ type: 'SOUND', sound: 'explosion' });

    const wepData = weaponType ? WEAPONS_DATA[weaponType] : undefined;

    state.players.forEach(p => {
        const dist = distance(pos, p.pos);
        if (dist < radius) {
            const dmg = (wepData?.damage ?? 100) * (1 - dist / radius);
            const kbDir = { x: p.pos.x - pos.x, y: p.pos.y - pos.y };
            applyDamage(state, p, ownerId, dmg, kbDir, wepData?.knockbackForce);
        }
    });
};

// --- Weapon Firing ---

export const fireWeapon = (state: GameState, p: Entity, target: Vector2) => {
    if (p.weapon.ammo <= 0) return;
    p.weapon.ammo--;
    p.lastFired = Date.now();

    const crouchY = p.isCrouching ? 15 : 0;
    const origin = { x: p.pos.x, y: p.pos.y - 50 + crouchY };

    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    p.vel.x -= dir.x * p.weapon.recoil;
    p.vel.y -= dir.y * p.weapon.recoil;

    if (p.weapon.type === WeaponType.RAILGUN) {
        const range = 2200;
        const end = { x: origin.x + dir.x * range, y: origin.y + dir.y * range };
        let closest = range;
        let hitPos = end;
        let hitPlayer: Entity | null = null;

        state.players.forEach(tgt => {
            if (tgt.id === p.id || tgt.dead) return;
            const rect = { x: tgt.pos.x - 15, y: tgt.pos.y - tgt.height, w: 30, h: tgt.height };
            if (segmentIntersectsRect(origin, end, rect)) {
                const d = distance(origin, tgt.pos);
                if (d < closest) { closest = d; hitPlayer = tgt; hitPos = { x: origin.x + dir.x * d, y: origin.y + dir.y * d }; }
            }
        });

        state.platforms.forEach(plat => {
            if (segmentIntersectsRect(origin, end, plat)) {
                const d = distance(origin, { x: plat.x, y: plat.y });
                if (d < closest) { closest = d; hitPlayer = null; hitPos = { x: origin.x + dir.x * d, y: origin.y + dir.y * d }; }
            }
        });

        if (hitPlayer) {
            applyDamage(state, hitPlayer, p.id, WEAPONS_DATA[WeaponType.RAILGUN].damage, dir, WEAPONS_DATA[WeaponType.RAILGUN].knockbackForce);
        }

        createParticles(state, hitPos.x, hitPos.y, 10, '#38bdf8', 'spark');

        if (!state.beams) state.beams = [];
        state.beams.push({
            id: nextId('beam_'),
            start: { x: origin.x, y: origin.y },
            end: { x: hitPos.x, y: hitPos.y },
            color: '#60a5fa',
            life: 1.0,
            width: 4
        });
        return;
    }

    if (p.weapon.type === WeaponType.CHAINSAW) {
        const reach = 70;
        const attackPos = { x: origin.x + dir.x * reach, y: origin.y + dir.y * reach };
        state.players.forEach(tgt => {
            if (tgt.id === p.id || tgt.dead) return;
            const dist = distance(attackPos, tgt.pos);
            if (dist < 60) {
                applyDamage(state, tgt, p.id, WEAPONS_DATA[WeaponType.CHAINSAW].damage, dir, WEAPONS_DATA[WeaponType.CHAINSAW].knockbackForce);
                createParticles(state, tgt.pos.x, tgt.pos.y - 20, 6, '#ef4444', 'blood');
            }
        });
        createParticles(state, attackPos.x, attackPos.y, 8, '#ef4444', 'spark');
        gameEvents.emit({ type: 'SOUND', sound: 'shoot', subtype: p.weapon.type });
        return;
    }

    const createProj = (spread = 0) => {
        const a = angle + spread;
        state.projectiles.push({
            id: nextId('proj_'), ownerId: p.id,
            pos: { x: origin.x + dir.x * 20, y: origin.y + dir.y * 20 },
            vel: { x: Math.cos(a) * p.weapon.speed, y: Math.sin(a) * p.weapon.speed },
            type: p.weapon.type, radius: 4, active: true,
            life: p.weapon.type === WeaponType.GRENADE_LAUNCHER ? 60 : undefined
        });
    }

    if (p.weapon.type === WeaponType.PLASMA_GUN) {
        createProj(0);
        gameEvents.emit({ type: 'SOUND', sound: 'shoot', subtype: p.weapon.type });
        return;
    }

    if (p.weapon.type === WeaponType.SHOTGUN) {
        for (let i = 0; i < 6; i++) createProj((Math.random() - 0.5) * 0.3);
    } else {
        createProj(0);
    }

    gameEvents.emit({ type: 'SOUND', sound: 'shoot', subtype: p.weapon.type });
    state.particles.push({
        id: nextId('pt_'), pos: { x: origin.x, y: origin.y },
        vel: { x: (Math.random() - 0.5) * 4, y: -2 - Math.random() * 2 },
        life: 1, decay: 0.05, color: '#fbbf24', size: 3, type: 'shell', rotation: Math.random() * Math.PI
    });
};
