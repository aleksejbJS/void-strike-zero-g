// Combat system — damage, weapons, explosions.
// Visual effects are announced as events (effects.ts), never written into state here.

import { GameState, Entity, Platform, Vector2, WeaponType, ItemType, GameMode, Team } from '../../types';
import { WEAPONS_DATA, RESPAWN_DELAY, SELF_DAMAGE_MULT, SELF_KNOCKBACK_MULT, KNOCKBACK_AIR_MULT, PROJECTILE_MAX_LIFE } from '../../constants';
import { gameEvents } from './events';
import { nextId } from '../utils/id';
import { distance, normalize, checkPointInRect, segmentRectEntry } from '../utils/math';
import { resetFlagToBase, handleGunGameKill, handleGunGameDeath, scheduleHungerZoneShrink } from './gamemodes';
import { trackKill } from './achievements';
import { emitEffect, emitDamage, emitDeath, emitLimb } from './effects';
import { deathKind, DamageSource, isHazardBlast, isOwnTankBlast, isSplash } from './deathKind';
import { shouldWound, inflictWound, killCredit } from './wound';
import { absorbArmor } from './armor';
import { emitFlag } from './flagEvents';
import { muzzleHeight } from './stance';
import { hungerShieldLeft } from './hungerRound';
import { spawnShieldLeft, dropSpawnShield } from './spawnShield';
import { railThroughCover, chainsawCover } from '../cover/coverHits';
import { killAchievementWeapon, killWeaponName } from './killWeaponName';
import { fireFlame } from './flamethrower';
import { extinguish } from './burning';
import { rollTankIgnition } from './fuelTank';
import { dropLitTank } from './fuelTankBlast';

// --- Teams ---

// True when both entities are on the same real team (free-for-all players are never teammates)
export const isTeammate = (a: Entity, b: Entity) =>
    a.id !== b.id && a.team !== Team.NONE && a.team === b.team;

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

/** `source`: what hurt the target (weapon, direct hit, origin); zone and fall damage pass none. */
export const applyDamage = (state: GameState, target: Entity, attackerId: string, amount: number, knockback: Vector2, knockbackForce?: number, source: DamageSource = {}) => {
    if (target.dead) return;
    // Falling out of the map still kills; everything else waits for the round-start shield
    if (amount < 9999 && hungerShieldLeft(state, Date.now()) > 0) return;
    if (amount < 9999 && spawnShieldLeft(target, Date.now()) > 0) return; // just respawned
    rollTankIgnition(target, attackerId, source, Date.now()); // before the wound and the death check: any hit can light the tank

    // Self-damage multiplier (rocket-jump)
    const isSelf = attackerId === target.id && !isHazardBlast(source); // a barrel or tank blast hurts its author like anyone else
    const dmgMult = isSelf ? SELF_DAMAGE_MULT : 1;
    const kbMult = isSelf ? SELF_KNOCKBACK_MULT : 1;

    // Directional knockback using weapon's knockbackForce
    const push = () => {
        const len = Math.sqrt(knockback.x * knockback.x + knockback.y * knockback.y) || 1;
        const airMult = target.isGrounded ? 1 : KNOCKBACK_AIR_MULT;
        const force = (knockbackForce ?? amount / 10) * kbMult * airMult; // 0 is a real value: no push
        target.vel.x += (knockback.x / len) * force;
        target.vel.y += (knockback.y / len) * force;
    };

    // A railgun beam through armor wounds instead of killing: the target lives (no death, no kill feed line)
    if (shouldWound(target, source)) {
        const hadLeg = !target.wound; // re-wounded through new armor: the leg is already gone
        const lost = inflictWound(target, attackerId);
        if (hadLeg) emitLimb(target, source.from);
        push();
        if (lost > 0) emitDamage(target.pos.x, target.pos.y - 40, lost);
        return;
    }

    // Bleeding and burning are plain health loss: no flag bonus, armor, knockback or damage number
    const plainLoss = !!source.bleed || !!source.burn;
    const holdingHTF = !plainLoss && state.mode === GameMode.HOLD_THE_FLAG && target.hasFlag === target.team;
    let dmg = (holdingHTF ? amount * 1.1 : amount) * dmgMult;
    if (!plainLoss) dmg = absorbArmor(target, dmg);
    const overkill = dmg - target.health; // after armor, against the health right before this hit
    target.health -= dmg;

    if (!plainLoss && !isOwnTankBlast(source)) { // a carrier torn apart by their own tank: no "9999" over them
        push();
        emitDamage(target.pos.x, target.pos.y - 40, dmg);
    }

    if (target.health <= 0) {
        // A wounded fighter's frag goes to the railgun shooter: decided before the wound is cleared
        const credit = killCredit(target, attackerId, source);
        target.dead = true;
        target.respawnTimer = state.mode === GameMode.HUNGER_GAMES ? Number.MAX_SAFE_INTEGER : (Date.now() + RESPAWN_DELAY);
        // Blood, decal and ragdoll: the kind says how the body falls; a lit tank stays on the corpse, which just drops
        const tankId = dropLitTank(state, target);
        emitDeath(target, tankId ? 'fall' : deathKind(source, overkill), source.from, !tankId && isSplash(source), tankId);
        target.wound = undefined; // after the event: it says oneLeg
        extinguish(target); // the dead burn no more

        // Hunger Games: shrink zone on each death (executed by tickHungerZoneShrink)
        if (state.mode === GameMode.HUNGER_GAMES) {
            scheduleHungerZoneShrink(state, Date.now());
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
                emitFlag('hold', 'lost', target.team);
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
                emitFlag('intel', 'lost');
            } else {
                // CTF: a flag goes home the moment its carrier dies
                resetFlagToBase(state, target.hasFlag);
                emitFlag('ctf', 'lost', target.hasFlag);
            }
            target.hasFlag = Team.NONE;
        }

        if (credit.attackerId) {
            const killer = state.players.find(p => p.id === credit.attackerId);
            gameEvents.emit({
                type: 'KILL',
                killer: killer ? killer.name : 'World',
                killerColor: killer ? killer.color : '#ffffff',
                weapon: killWeaponName(killer, credit.weapon, source),
                victim: target.name,
                victimColor: target.color
            });
            // Award score (suicide and killing a teammate give nothing)
            if (killer && killer.id !== target.id && !isTeammate(killer, target)) {
                if (state.mode !== GameMode.CTF) {
                    killer.score++;
                } else if (killer.team !== target.team) {
                    killer.score += 100;
                }

                // A barrel or tank kill scores but does not move the Gun Game ladder
                if (state.mode === GameMode.GUN_GAME && !isHazardBlast(source)) {
                    handleGunGameKill(state, killer);
                }

                // Track achievement only for player-controlled kills
                if (killer.type === 'player') trackKill(killAchievementWeapon(killer, credit.weapon, source));
            }
        }
    }
};

// --- Weapon Firing ---

/** Where a fighter's shots start (crouching and lying lower the gun). */
export const shotOrigin = (p: Entity): Vector2 => ({ x: p.pos.x, y: p.pos.y - muzzleHeight(p) });

export const fireWeapon = (state: GameState, p: Entity, target: Vector2) => {
    if (p.weapon.ammo <= 0) return;
    p.weapon.ammo--;
    p.lastFired = Date.now();
    dropSpawnShield(p); // shooting ends spawn protection

    const origin = shotOrigin(p);

    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    p.vel.x -= dir.x * p.weapon.recoil;
    p.vel.y -= dir.y * p.weapon.recoil;

    if (p.weapon.type === WeaponType.FLAMETHROWER) {
        fireFlame(state, p, origin, dir, Date.now());
        return;
    }

    if (p.weapon.type === WeaponType.RAILGUN) {
        const range = 2200;
        const end = { x: origin.x + dir.x * range, y: origin.y + dir.y * range };
        // Closest hit along the beam, as a fraction of its length
        let closestT = 1;
        let hitPlayer: Entity | null = null;

        state.players.forEach(tgt => {
            if (tgt.id === p.id || tgt.dead || isTeammate(p, tgt)) return;
            const rect = { x: tgt.pos.x - 15, y: tgt.pos.y - tgt.height, w: 30, h: tgt.height };
            const t = segmentRectEntry(origin, end, rect);
            if (t !== null && t < closestT) { closestT = t; hitPlayer = tgt; }
        });

        state.platforms.forEach(plat => {
            const t = segmentRectEntry(origin, end, plat);
            if (t !== null && t < closestT) { closestT = t; hitPlayer = null; }
        });

        // Metal and barrels stop the beam in front of whoever stands behind; wood and glass break and let it pass
        const stopT = railThroughCover(state, origin, end, closestT, p.id, Date.now());
        if (stopT < closestT) { closestT = stopT; hitPlayer = null; }

        const hitPos = { x: origin.x + dir.x * range * closestT, y: origin.y + dir.y * range * closestT };

        if (hitPlayer) {
            applyDamage(state, hitPlayer, p.id, WEAPONS_DATA[WeaponType.RAILGUN].damage, dir, WEAPONS_DATA[WeaponType.RAILGUN].knockbackForce,
                { weapon: WeaponType.RAILGUN, from: origin });
        }

        // Blood where the beam enters a fighter, blue sparks where it stops at a wall
        if (hitPlayer) emitEffect('blood', hitPos.x, hitPos.y, '#ef4444', 6);
        else emitEffect('spark', hitPos.x, hitPos.y, '#38bdf8', 10);

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
            if (tgt.id === p.id || tgt.dead || isTeammate(p, tgt)) return;
            const dist = distance(attackPos, tgt.pos);
            if (dist < 60) {
                applyDamage(state, tgt, p.id, WEAPONS_DATA[WeaponType.CHAINSAW].damage, dir, WEAPONS_DATA[WeaponType.CHAINSAW].knockbackForce,
                    { weapon: WeaponType.CHAINSAW, from: origin });
                emitEffect('blood', tgt.pos.x, tgt.pos.y - 20, '#ef4444', 6);
            }
        });
        chainsawCover(state, attackPos, p.id, Date.now());
        emitEffect('spark', attackPos.x, attackPos.y, '#ef4444', 8);
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
            life: p.weapon.type === WeaponType.GRENADE_LAUNCHER || p.weapon.type === WeaponType.SMOKE_LAUNCHER ? 60 : PROJECTILE_MAX_LIFE
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
    emitEffect('shell', origin.x, origin.y);
};
