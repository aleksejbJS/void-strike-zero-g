import { GameState, Entity, ItemType, Pickup, GameMode, Team, Vector2, WeaponType, Weapon } from '../../types';
import { BOT_AIM_DISTANCE, BOT_FIRE_COOLDOWN_SCALE, BOT_MOVE_SPEED, BOT_VERTICAL_TOLERANCE, WEAPONS_DATA } from '../../constants';
import { distance, normalize, checkPointInRect } from '../utils/math';
import { EXTRACTION_ZONE, getWaypoints } from '../data/level';

type BotState = 'hunt' | 'defend' | 'retreat' | 'flag-run' | 'roam';

interface BotMemory {
    state: BotState;
    targetId: string | null;
    roamIndex: number;
    stuckTimer: number;
    lastPos: Vector2;
}

const botMemory = new Map<string, BotMemory>();
export const clearBotMemory = () => botMemory.clear();
const getMem = (bot: Entity, mode?: GameMode): BotMemory => {
    if (!botMemory.has(bot.id)) {
        botMemory.set(bot.id, { state: 'roam', targetId: null, roamIndex: Math.floor(Math.random() * getWaypoints(mode).length), stuckTimer: 0, lastPos: { ...bot.pos } });
    }
    return botMemory.get(bot.id)!;
};

const scoreWeaponForDistance = (weapon: Weapon, dist: number) => {
    // Higher score = better choice. Rough heuristics by role.
    switch (weapon.type) {
        case WeaponType.CHAINSAW: return dist < 90 ? 120 - dist : -100;
        case WeaponType.SHOTGUN: return 100 - Math.max(0, dist - 60) * 0.6;
        case WeaponType.ROCKET_LAUNCHER: return 90 - Math.max(0, dist - 120) * 0.35;
        case WeaponType.GRENADE_LAUNCHER: return 85 - Math.max(0, dist - 140) * 0.3;
        case WeaponType.PLASMA_GUN: return 70 - Math.max(0, dist - 260) * 0.25;
        case WeaponType.RAILGUN: return dist > 280 ? 110 - Math.max(0, (dist - 280) * 0.1) : 40 + dist * 0.05;
        default: return 60 - Math.max(0, dist - 240) * 0.2; // Machine gun fallback
    }
};

const pickBestWeapon = (bot: Entity, dist: number) => {
    let best = bot.weapon;
    let bestScore = scoreWeaponForDistance(best, dist) + (best.ammo / Math.max(1, best.maxAmmo)) * 30;
    bot.inventory.forEach(w => {
        if (w.ammo <= 0) return;
        const s = scoreWeaponForDistance(w, dist) + (w.ammo / Math.max(1, w.maxAmmo)) * 30;
        if (s > bestScore + 5) { // small hysteresis
            best = w; bestScore = s;
        }
    });
    bot.weapon = best;
};

const findWeaponPickup = (state: GameState, bot: Entity): Pickup | null => {
    let best: Pickup | null = null;
    let bestDist = Infinity;
    state.pickups.forEach(item => {
        if (!item.active || item.type !== ItemType.WEAPON || !item.subtype) return;
        const existing = bot.inventory.find(w => w.type === item.subtype);
        const needsAmmo = existing ? existing.ammo < existing.maxAmmo * 0.4 : true;
        if (!existing && item.subtype === WeaponType.MACHINE_GUN) return; // skip default gun duplicates
        if (!existing && item.subtype === bot.weapon.type && bot.weapon.ammo > bot.weapon.maxAmmo * 0.5) return;
        if (!needsAmmo) return;
        const d = distance(bot.pos, item.pos);
        if (d < bestDist) { bestDist = d; best = item; }
    });
    return best;
};

export const botHasLineOfSight = (state: GameState, from: Vector2, to: Vector2) => {
    const dir = normalize({ x: to.x - from.x, y: to.y - from.y });
    let cur = { ...from };
    let dist = 0;
    while (dist < BOT_AIM_DISTANCE) {
        cur.x += dir.x * 20;
        cur.y += dir.y * 20;
        dist += 20;
        if (checkPointInRect(cur, { x: to.x - 10, y: to.y - 10, w: 20, h: 20 })) return true;
        for (const p of state.platforms) if (checkPointInRect(cur, p)) return false;
    }
    return false;
};

export const updateBotAI = (bot: Entity, state: GameState, now: number, fireWeaponCallback: (bot: Entity, target: Vector2) => void, mode?: GameMode): boolean => {
    if (bot.dead) return false;
    const mem = getMem(bot, mode);

    let inputX = 0;
    let isFlying = false;
    let moveTarget = bot.pos;
    let target: Entity | null = null;
    let minDist = Infinity;

    // 1. Find Enemy (FFA in Hunger Games/DM)
    state.players.forEach(other => {
        const isEnemy = state.mode === GameMode.DEATHMATCH || state.mode === GameMode.HUNGER_GAMES ? other.id !== bot.id : other.team !== bot.team;
        if (other.id !== bot.id && !other.dead && isEnemy) {
            const d = distance(bot.pos, other.pos);
            if (d < minDist) {
                minDist = d;
                target = other;
            }
        }
    });

    const distToTarget = target ? minDist : 400;
    pickBestWeapon(bot, distToTarget);

    // Hunger Games: stay inside zone
    if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone) {
        const hz = state.hungerZone;
        const inside = bot.pos.x > hz.x && bot.pos.x < hz.x + hz.w && bot.pos.y > hz.y && bot.pos.y < hz.y + hz.h;
        if (!inside) {
            moveTarget = { x: hz.x + hz.w / 2, y: hz.y + hz.h / 2 };
            mem.state = 'retreat';
        }
    }

    // 2. Survival: If low HP, prioritize health
    if (bot.health < 60) {
        let nearestHealth: Pickup | null = null;
        let minHPDist = Infinity;
        state.pickups.forEach(item => {
            if (item.active && item.type === ItemType.HEALTH) {
                const d = distance(bot.pos, item.pos);
                if (d < minHPDist) { minHPDist = d; nearestHealth = item; }
            }
        });
        if (nearestHealth) { moveTarget = (nearestHealth as Pickup).pos; mem.state = 'retreat'; target = null; }
    }
    // 3. Objective: HOLD THE FLAG
    else if (state.mode === GameMode.HOLD_THE_FLAG) {
        const neutralFlag = state.pickups.find(i => i.type === ItemType.FLAG && i.team === Team.NONE && i.active);
        const enemyHolder = state.players.find(p => p.team !== bot.team && p.hasFlag === p.team && !p.dead);

        if (bot.hasFlag === bot.team) {
            // I have the flag - defend it and fight enemies
            mem.state = 'defend';
            if (enemyHolder) {
                moveTarget = enemyHolder.pos;
                target = enemyHolder;
            } else if (target) {
                // Keep moving to avoid being an easy target
                const avoidDir = { x: bot.pos.x - target.pos.x, y: bot.pos.y - target.pos.y };
                const avoidDist = Math.sqrt(avoidDir.x * avoidDir.x + avoidDir.y * avoidDir.y) || 1;
                moveTarget = {
                    x: bot.pos.x + (avoidDir.x / avoidDist) * 100,
                    y: bot.pos.y
                };
            }
        } else if (neutralFlag) {
            // Flag is available - go get it!
            mem.state = 'flag-run';
            moveTarget = neutralFlag.pos;
        } else if (enemyHolder) {
            // Enemy has the flag - hunt them down!
            mem.state = 'hunt';
            moveTarget = enemyHolder.pos;
            target = enemyHolder;
        } else if (target) {
            // No flag available, just fight
            mem.state = 'hunt';
            moveTarget = target.pos;
        }
    }
    // 4. Objective: INFILTRATION
    else if (state.mode === GameMode.INFILTRATION) {
        const intel = state.pickups.find(i => i.type === ItemType.INTEL);
        const carrier = state.players.find(p => p.hasFlag === Team.RED && !p.dead);
        const extraction = { x: EXTRACTION_ZONE.x + EXTRACTION_ZONE.w / 2, y: EXTRACTION_ZONE.y + EXTRACTION_ZONE.h / 2 };

        if (bot.team === Team.BLUE) {
            if (carrier) {
                moveTarget = carrier.id === bot.id ? extraction : carrier.pos;
                mem.state = 'flag-run';
            } else if (intel) {
                moveTarget = intel.pos;
                mem.state = 'hunt';
            } else if (target) {
                moveTarget = target.pos;
                mem.state = 'hunt';
            }
        } else {
            if (carrier) {
                moveTarget = carrier.pos;
                target = carrier;
                mem.state = 'hunt';
            } else if (intel) {
                if (distance(bot.pos, intel.pos) > 400) moveTarget = intel.pos;
                mem.state = 'defend';
            }
        }
    }
    // 5. Objective: CTF
    else if (state.mode === GameMode.CTF) {
        if (bot.hasFlag !== Team.NONE) {
            mem.state = 'flag-run';
            moveTarget = bot.team === Team.BLUE ? { x: -350, y: 450 } : { x: 2350, y: 450 };
        } else {
            const enemyCarrier = state.players.find(p => p.hasFlag === bot.team);
            if (enemyCarrier) { mem.state = 'defend'; moveTarget = enemyCarrier.pos; target = enemyCarrier; }
            else {
                const enemyFlag = state.pickups.find(i => i.type === ItemType.FLAG && i.team !== bot.team && i.active);
                if (enemyFlag) { mem.state = 'flag-run'; moveTarget = enemyFlag.pos; }
                else if (target) { mem.state = 'hunt'; moveTarget = target.pos; }
            }
        }
    }
    // 4. Combat Movement
    else if (target) {
        mem.state = 'hunt';
        const preferredDist = bot.weapon.type === WeaponType.SHOTGUN || bot.weapon.type === WeaponType.CHAINSAW ? 120 : 320;
        if (minDist > preferredDist) moveTarget = target.pos;
        else if (minDist < preferredDist - 120) moveTarget = { x: bot.pos.x - (target.pos.x - bot.pos.x), y: bot.pos.y };
        else moveTarget = bot.pos;
    } else {
        mem.state = 'roam';
        const waypoints = getWaypoints(mode);
        const wp = waypoints[mem.roamIndex % waypoints.length];
        moveTarget = wp;
        if (distance(bot.pos, wp) < 50) mem.roamIndex = (mem.roamIndex + 1) % waypoints.length;
    }

    // 4.5 Weapon seeking (deathmatch + free roam). Skip if retreating for HP or carrying flag.
    if (mem.state !== 'retreat' && bot.hasFlag === Team.NONE) {
        const lowAmmo = bot.weapon.ammo < bot.weapon.maxAmmo * 0.25;
        const hasOnlyStarter = bot.inventory.length <= 1;
        const weaponPickup = findWeaponPickup(state, bot);
        if (weaponPickup && (lowAmmo || hasOnlyStarter || (!target && (state.mode === GameMode.DEATHMATCH || state.mode === GameMode.HUNGER_GAMES)))) {
            moveTarget = weaponPickup.pos;
            mem.state = 'hunt';
        }
    }

    // Movement Execution
    const dx = moveTarget.x - bot.pos.x;
    if (Math.abs(dx) > 30) inputX = dx > 0 ? 1 : -1;

    // Verticality (Jetpack)
    if ((moveTarget.y < bot.pos.y - 80 || !bot.isGrounded) && bot.jetpackFuel > 5) isFlying = true;
    if (target && target.pos.y < bot.pos.y - 100 && bot.jetpackFuel > 30) isFlying = true;

    // Shooting
    let aimTarget = target ? target.pos : { x: bot.pos.x + inputX * 100, y: bot.pos.y };

    if (target) {
        const dist = distance(bot.pos, target.pos);
        const timeToHit = dist / bot.weapon.speed;
        aimTarget = {
            x: target.pos.x + target.vel.x * timeToHit,
            y: target.pos.y + target.vel.y * timeToHit - 50
        };

        const dy = Math.abs(target.pos.y - bot.pos.y);
        const fireReady = now - bot.lastFired > bot.weapon.fireRate * BOT_FIRE_COOLDOWN_SCALE;
        const see = botHasLineOfSight(state, bot.pos, target.pos);
        if (dy < BOT_VERTICAL_TOLERANCE && dist < BOT_AIM_DISTANCE && fireReady && see) {
            fireWeaponCallback(bot, {
                x: aimTarget.x + (Math.random() - 0.5) * 40,
                y: aimTarget.y + (Math.random() - 0.5) * 40
            });
        }
    }

    // Apply inputs to bot entity
    bot.facingRight = aimTarget.x > bot.pos.x;
    bot.vel.x += inputX * (bot.isGrounded ? BOT_MOVE_SPEED : BOT_MOVE_SPEED * 0.6);

    // Anti-stuck
    if (distance(bot.pos, mem.lastPos) < 2) {
        mem.stuckTimer += 1;
        if (mem.stuckTimer > 30) { bot.vel.y = -6; mem.stuckTimer = 0; mem.roamIndex = (mem.roamIndex + 1) % getWaypoints(mode).length; }
    } else {
        mem.stuckTimer = 0;
    }
    mem.lastPos = { ...bot.pos };

    return isFlying;
};
