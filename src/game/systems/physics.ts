import { GameState, WeaponType, ItemType, GameMode, Team, PlayerInput, Projectile, Entity } from '../../types';
import { WEAPONS_DATA, ITEM_RESPAWN_TIME, HTF_SCORE_INTERVAL, INFILTRATION_TIMER, PROJECTILE_MAX_LIFE, DEFAULT_MAX_FUEL, ROCKET_MOTOR_TICKS } from '../../constants';
import { gameEvents } from './events';
import { nextId } from '../utils/id';
import { pickupRect } from '../utils/pickupRect';
import { updateBotAI } from './bot';
import { checkPointInRect, checkRectOverlap, distance, segmentIntersectsRect, segmentRectEntry } from '../utils/math';
import { baseFlagPos, HTF_FLAG_POS, EXTRACTION_ZONE, INTEL_POS } from '../data/level';
import { bumpStat } from '../stats/playerStats';
import { tickFlagHold } from '../stats/flagHold';
import { resetFlagToBase, applyGunGameLoadout, tickHungerZoneShrink } from './gamemodes';
import { applyDamage, fireWeapon, isTeammate } from './combat';
import { createExplosion } from './explosion';
import { projectileCoverHit } from '../cover/coverHits';
import { damageCover } from '../cover/coverDamage';
import { healWound } from './wound';
import { tickBleeding } from './bleeding';
import { grantSpawnShield } from './spawnShield';
import { liftOutOfCover } from '../cover/coverSpawn';
import { tickCover } from '../cover/coverTick';
import { emitEffect, emitText, projectileTrail } from './effects';
import { emitFlag } from './flagEvents';
import { updateParticles, updateFloatingTexts, updateDecals } from './particles';
import { updateCorpses } from './ragdoll/corpses';
import { readControls, updateAim, updateGrapple, applyPlayerMovement, PlayerControls, NO_KEYS } from './playerControl';
import { applyStance, clampProneAim } from './stance';
import { followCamera, pickCameraTarget } from './camera';
import { updateHungerRound } from './hungerRound';
import { updateMatch } from './matchRound';
import { duelLoadout, duelSpawnPoint } from './duelRules';
import { spawnSmoke, updateSmokes } from './smoke';

// Projectile flight for one tick (also used by clients to extrapolate between snapshots)
export const moveProjectile = (proj: Projectile) => {
    proj.pos.x += proj.vel.x;
    proj.pos.y += proj.vel.y;
    // A rocket flies straight while its motor burns, then drops (age comes from the life it has left)
    const age = PROJECTILE_MAX_LIFE - (proj.life ?? PROJECTILE_MAX_LIFE);
    if (proj.type === WeaponType.ROCKET_LAUNCHER && age >= ROCKET_MOTOR_TICKS) proj.vel.y += 0.1;
    if (proj.type === WeaponType.GRENADE_LAUNCHER || proj.type === WeaponType.SMOKE_LAUNCHER) proj.vel.y += 0.25;
};

// --- MAIN PHYSICS UPDATE LOOP ---
export const updatePhysics = (state: GameState, keys: any, mouse: any, hookPressed: boolean, mousePressed: boolean, screenW: number, screenH: number, getSpawnPoint: any, localPlayerId: string, remoteInputs?: Record<string, PlayerInput>) => {
    const now = Date.now();

    // Match over and the results screen is up: freeze everyone, keep only visuals moving
    if (state.matchEndsAt) {
        state.players.forEach(p => { p.vel = { x: 0, y: 0 }; });
        updateParticles(state);
        updateFloatingTexts(state);
        updateDecals(state, now);
        updateCorpses(state);
        followCamera(state, pickCameraTarget(state, localPlayerId));
        return;
    }

    // Respawn
    state.players.forEach(p => {
        if (p.dead) {
            if (state.mode === GameMode.HUNGER_GAMES) return;
            if (now > p.respawnTimer) {
                p.dead = false; p.health = 100; p.armor = 0;
                p.maxFuel = DEFAULT_MAX_FUEL; p.jetpackFuel = DEFAULT_MAX_FUEL;
                p.pos = state.mode === GameMode.DUEL ? duelSpawnPoint(state, p.id) : getSpawnPoint(p.team);
                p.vel = { x: 0, y: 0 };
                liftOutOfCover(state, p);
                if (state.mode === GameMode.GUN_GAME) {
                    applyGunGameLoadout(p, p.gunLevel || 0);
                } else if (state.mode === GameMode.DUEL) {
                    p.inventory = duelLoadout();
                    p.weapon = p.inventory[0];
                } else {
                    p.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }];
                    p.weapon = p.inventory[0];
                }
                p.hasFlag = Team.NONE;
                grantSpawnShield(p, now);
                emitEffect('respawn', p.pos.x, p.pos.y);
            }
        }
    });

    // Hunger Games shrinking zone damage (frozen once the round is decided)
    if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone && !state.hungerRoundEndsAt) {
        tickHungerZoneShrink(state, now);
        const hz = state.hungerZone;
        const graceShrink = hz.lastShrink ? now - hz.lastShrink < 800 : false;
        const outsideGraceMs = 500;
        const pad = 5;
        state.players.forEach(p => {
            if (p.dead) return;
            const inside = p.pos.x > hz.x && p.pos.x < hz.x + hz.w && p.pos.y > hz.y && p.pos.y < hz.y + hz.h;
            if (!inside && !graceShrink) {
                if (!p.hungerOutTimer) p.hungerOutTimer = now;
                const over = now - (p.hungerOutTimer || now);
                // Clamp back into zone to prevent walking outside
                if (p.pos.x < hz.x + pad) { p.pos.x = hz.x + pad; p.vel.x = Math.min(p.vel.x, 0); }
                if (p.pos.x > hz.x + hz.w - pad) { p.pos.x = hz.x + hz.w - pad; p.vel.x = Math.max(p.vel.x, 0); }
                if (p.pos.y < hz.y + pad) { p.pos.y = hz.y + pad; p.vel.y = Math.max(p.vel.y, 0); }
                if (p.pos.y > hz.y + hz.h - pad) { p.pos.y = hz.y + hz.h - pad; p.vel.y = Math.min(p.vel.y, 0); }
                if (over > outsideGraceMs) {
                    applyDamage(state, p, '', 6, { x: 0, y: 0 });
                }
            } else {
                p.hungerOutTimer = undefined;
            }
        });
    }

    // Гарантируем наличие флагов в CTF (на случай пустого массива)
    if (state.mode === GameMode.CTF && !state.pickups.some(p => p.type === ItemType.FLAG)) {
        state.pickups.push(
            { id: 'flag_blue', type: ItemType.FLAG, team: Team.BLUE, pos: baseFlagPos(Team.BLUE), active: true, respawnTime: 0, value: 0 },
            { id: 'flag_red', type: ItemType.FLAG, team: Team.RED, pos: baseFlagPos(Team.RED), active: true, respawnTime: 0, value: 0 }
        );
    }
    if (state.mode === GameMode.HOLD_THE_FLAG && !state.pickups.some(p => p.type === ItemType.FLAG)) {
        state.pickups.push({
            id: nextId('htf_flag_'),
            type: ItemType.FLAG,
            team: Team.NONE,
            pos: { ...HTF_FLAG_POS },
            active: true,
            respawnTime: 0,
            value: 0
        });
    }
    if (state.mode === GameMode.INFILTRATION && !state.pickups.some(p => p.type === ItemType.INTEL)) {
        state.pickups.push({
            id: `intel_${Date.now()}`,
            type: ItemType.INTEL,
            team: Team.RED,
            pos: { ...INTEL_POS },
            active: true,
            respawnTime: -1,
            value: 1000
        });
    }

    // Pickups Respawn
    state.pickups.forEach(item => {
        if (!item.active && item.type !== ItemType.FLAG && item.type !== ItemType.INTEL && now > item.respawnTime) item.active = true;
        else if (!item.active && item.type === ItemType.FLAG && now > item.respawnTime && item.respawnTime > 0) {
            item.active = true;
            item.pos = baseFlagPos(item.team || Team.BLUE);
        }
    });

    // Players Logic
    state.players.forEach(p => {
        if (p.dead) return;

        let controls: PlayerControls;
        if (p.type === 'player') {
            const isLocal = p.id === localPlayerId;
            const remote = remoteInputs?.[p.id];
            // A human with no input this tick (e.g. a remote player before their first packet) stands still
            const pKeys = remote ? remote.keys : isLocal ? keys : NO_KEYS;
            const pMousePressed = remote ? remote.mousePressed : isLocal && mousePressed;
            const pHookPressed = remote ? remote.hookPressed : isLocal && hookPressed;

            controls = readControls(p, pKeys);
            applyStance(p, controls); // before firing: crouching and lying lower the muzzle

            // Local mouse is in screen coords; remote inputs already carry world coords
            const rawAim = remote
                ? remote.mouse
                : isLocal
                    ? { x: mouse.x - screenW / 2 + state.camera.x, y: mouse.y - screenH / 2 + state.camera.y }
                    : null;
            const aim = rawAim && clampProneAim(p, rawAim);
            if (aim) updateAim(p, aim);

            if (aim && pMousePressed && now - p.lastFired > p.weapon.fireRate) {
                fireWeapon(state, p, aim);
            }
            updateGrapple(state, p, pHookPressed, aim ?? p.pos);

            if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team && controls.wantsJump && p.isCrouching) {
                state.pickups.push({
                    id: nextId('htf_throw_'),
                    type: ItemType.FLAG,
                    team: Team.NONE,
                    pos: { x: p.pos.x + (Math.random() - 0.5) * 20, y: p.pos.y },
                    active: true,
                    respawnTime: 0,
                    value: 0
                });
                p.hasFlag = Team.NONE;
                emitFlag('hold', 'lost', p.team);
            }
        } else {
            // Bots press the same controls a player has
            const bot = updateBotAI(p, state, now, (b, target) => fireWeapon(state, b, target), state.mode);
            updateGrapple(state, p, bot.hook, bot.hookAim ?? p.pos);
            controls = { inputX: bot.inputX, wantsJump: bot.reel, wantsDown: !!bot.wantsDown, wantsProne: false, isFlying: bot.isFlying };
            applyStance(p, controls); // crouching behind cover
        }

        // Force Pipeline — unified movement (gravity, input, jetpack, grapple, friction, speed caps)
        applyPlayerMovement(state, p, controls, state);

        // Map Bounds Death (ALL entities)
        if (p.pos.y > 2500) applyDamage(state, p, '', 9999, { x: 0, y: 0 });

        if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone) {
            // Keep players inside zone, but smooth clamp to avoid jitter
            const hz = state.hungerZone;
            const pad = 10;
            if (p.pos.x < hz.x + pad && p.vel.x < 0) p.vel.x = 0;
            if (p.pos.x > hz.x + hz.w - pad && p.vel.x > 0) p.vel.x = 0;
            if (p.pos.y < hz.y + pad && p.vel.y < 0) p.vel.y = 0;
            if (p.pos.y > hz.y + hz.h - pad && p.vel.y > 0) p.vel.y = 0;
        }

        // Item Collection (ALL entities)
        state.pickups.forEach(item => {
            const itemRect = pickupRect(item);
            const playerRect = { x: p.pos.x - 15, y: p.pos.y - p.height, w: 30, h: p.height };

            if (item.active && checkRectOverlap(itemRect, playerRect)) {
                let collected = false;
                let itemCollected = false;

                // Gun Game: hard-block weapon pickups entirely
                if (state.mode === GameMode.GUN_GAME && item.type === ItemType.WEAPON) {
                    item.active = false;
                    item.respawnTime = Number.MAX_SAFE_INTEGER;
                    return;
                }
                if (p.type === 'bot' && item.subtype === WeaponType.SMOKE_LAUNCHER) return; // bots never pick it up; it stays for humans
                if (item.type === ItemType.HEALTH && p.health < 100) { p.health = Math.min(100, p.health + item.value); healWound(p); collected = true; }
                else if (item.type === ItemType.ARMOR && p.armor < 100) { p.armor = Math.min(100, p.armor + item.value); collected = true; }
                else if (item.type === ItemType.AMMO) { p.inventory.forEach(w => w.ammo = Math.min(w.maxAmmo, w.ammo + item.value)); collected = true; }
                else if (item.type === ItemType.WEAPON) {
                    // Gun Game disables weapon pickups to preserve ladder progression
                    if (state.mode !== GameMode.GUN_GAME) {
                        const has = p.inventory.find(w => w.type === item.subtype);
                        if (has) has.ammo = Math.min(has.maxAmmo, has.ammo + 10); else if (item.subtype) p.inventory.push({ ...WEAPONS_DATA[item.subtype] });
                        // Don't auto-switch weapon - let player choose
                        collected = true;
                    }
                }
                else if (item.type === ItemType.FUEL) {
                    p.maxFuel = item.value; // Set max fuel to 150
                    p.jetpackFuel = p.maxFuel; // Refill completely
                    collected = true;
                }
                else if (item.type === ItemType.INTEL) {
                    const canGrab = state.mode === GameMode.INFILTRATION && p.team === Team.BLUE && p.hasFlag === Team.NONE;
                    if (canGrab && item.active) {
                        p.hasFlag = Team.RED;
                        collected = true;
                        item.active = false;
                        item.respawnTime = -1;
                        emitText(p.pos.x, p.pos.y - 30, 'GRABBED', '#facc15');
                        gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                        emitFlag('intel', 'grabbed');
                    }
                }
                else if (item.type === ItemType.FLAG) {
                    if (state.mode === GameMode.HOLD_THE_FLAG) {
                        const isNeutralFlag = item.team === Team.NONE;
                        const canPickup = p.team !== Team.NONE && p.hasFlag === Team.NONE;
                        if (isNeutralFlag && canPickup) {
                            p.hasFlag = p.team;
                            collected = true;
                            item.active = false;
                            item.respawnTime = 0;
                            state.lastHTFScore = now;
                            emitFlag('hold', 'grabbed', p.team);
                        }
                    } else {
                        if (item.team !== p.team && item.active) {
                            item.active = false;
                            item.respawnTime = 0;
                            p.hasFlag = item.team!;
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                            emitFlag('ctf', 'grabbed', item.team!);
                        } else if (p.hasFlag !== Team.NONE) {
                            // Захват: приносим в свою базу
                            state.scores[p.team]++;
                            resetFlagToBase(state, p.hasFlag);
                            p.hasFlag = Team.NONE;
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                            emitFlag('ctf', 'captured', p.team);
                            if (p.type === 'player') bumpStat(state, p.id, 'flagCaptures');
                        } else if (!item.active) {
                            // Ничего — флаг временно унесен
                        } else if (Math.abs(item.pos.x - (item.team === Team.BLUE ? -350 : 2350)) > 100) {
                            resetFlagToBase(state, item.team!);
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                            emitFlag('ctf', 'returned', item.team!);
                        }
                    }
                }
                if (collected) {
                    if (item.type !== ItemType.FLAG) {
                        item.active = false;
                        item.respawnTime = Date.now() + ITEM_RESPAWN_TIME;
                    }
                    gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                }

                if (collected && p.type === 'player') bumpStat(state, p.id, 'itemPickups');
            }
        });
    });

    // Bleeding: wounded fighters lose health until a medkit (after pickups, so a medkit stops it this tick)
    tickBleeding(state);

    // Projectiles Update
    state.projectiles.forEach(proj => {
        const prevPos = { ...proj.pos };
        moveProjectile(proj);
        projectileTrail(state, proj);
        proj.life = (proj.life ?? PROJECTILE_MAX_LIFE) - 1;

        let hit = false;
        let hitFighter = false;
        let impact = proj.pos;
        let target: Entity | null = null;
        const wall = state.platforms.find(plat => checkPointInRect(proj.pos, plat) || segmentIntersectsRect(prevPos, proj.pos, plat));
        const coverHit = projectileCoverHit(state, prevPos, proj.pos); // intact cover is a wall too: the nearer one is hit
        if (wall || coverHit) {
            hit = true;
            impact = prevPos; // explode on the near side of the wall, not inside it
        } else {
            // Only the first player along this tick's path is hit (no piercing)
            const owner = state.players.find(o => o.id === proj.ownerId);
            let nearest = Infinity;
            for (const p of state.players) {
                if (p.id === proj.ownerId || p.dead || (owner && isTeammate(owner, p))) continue;
                const entry = segmentRectEntry(prevPos, proj.pos, { x: p.pos.x - 15, y: p.pos.y - p.height, w: 30, h: p.height });
                if (entry !== null && entry < nearest) { nearest = entry; target = p; }
            }
            if (target) {
                hit = true;
                hitFighter = true;
                const source = { weapon: proj.type, direct: true, from: prevPos, shooterDist: owner ? distance(owner.pos, target.pos) : undefined };
                applyDamage(state, target, proj.ownerId, WEAPONS_DATA[proj.type].damage, proj.vel, WEAPONS_DATA[proj.type].knockbackForce, source);
            }
        }
        const smokeRound = proj.type === WeaponType.SMOKE_LAUNCHER;
        if ((proj.type === WeaponType.GRENADE_LAUNCHER || smokeRound) && proj.life <= 0) hit = true;
        // Stray projectile ran out of life without hitting anything — remove silently
        if (!hit && proj.life <= 0) proj.active = false;

        if (hit) {
            proj.active = false;
            const explosive = proj.type === WeaponType.ROCKET_LAUNCHER || proj.type === WeaponType.GRENADE_LAUNCHER;
            if (explosive) {
                // A rocket that hit a full-health fighter finishes them with its blast: still a direct hit
                createExplosion(state, impact, proj.ownerId, 150, proj.type, target?.id, { directCoverId: coverHit?.id });
            } else {
                if (smokeRound) spawnSmoke(state, impact, now); // bursts into a cloud: no blast, no damage splash
                else if (coverHit) damageCover(state, coverHit, WEAPONS_DATA[proj.type].damage, proj.ownerId, now);
                gameEvents.emit({ type: 'SOUND', sound: 'hit' });
            }
            // Any weapon hitting a fighter draws blood; a wall hit throws sparks. An explosive keeps its
            // own spark either way (it is part of the blast, not of the hit).
            if (hitFighter) emitEffect('blood', proj.pos.x, proj.pos.y, '#ef4444', 6);
            if (explosive || (!hitFighter && !smokeRound)) emitEffect('spark', proj.pos.x, proj.pos.y, WEAPONS_DATA[proj.type].color, 8);
        }
    });
    state.projectiles = state.projectiles.filter(p => p.active);

    // Cover: lit barrels go off, broken pieces come back (after the shots, so a barrel hit this tick is lit already)
    tickCover(state, now);

    // Beams Update
    if (!state.beams) state.beams = [];
    state.beams.forEach(beam => {
        beam.life -= 0.05; // Fade out speed
    });
    state.beams = state.beams.filter(b => b.life > 0);
    updateSmokes(state, now);

    tickFlagHold(state); // flag time for the stats, once per tick

    // Hold The Flag scoring tick
    if (state.mode === GameMode.HOLD_THE_FLAG) {
        const holder = state.players.find(p => !p.dead && p.hasFlag === p.team && p.team !== Team.NONE);
        if (holder && now - (state.lastHTFScore || 0) >= HTF_SCORE_INTERVAL) {
            state.scores[holder.team] += 1;
            state.lastHTFScore = now;
            emitText(holder.pos.x, holder.pos.y - 20, '+1', '#22c55e');
            gameEvents.emit({ type: 'SOUND', sound: 'score' });
        }
    }

    if (state.mode === GameMode.INFILTRATION) {
        if (!state.infiltrationEndTime) state.infiltrationEndTime = now + INFILTRATION_TIMER;
        const intel = state.pickups.find(p => p.type === ItemType.INTEL);
        const carrier = state.players.find(p => !p.dead && p.hasFlag === Team.RED);
        const extractionRect = { x: EXTRACTION_ZONE.x, y: EXTRACTION_ZONE.y, w: EXTRACTION_ZONE.w, h: EXTRACTION_ZONE.h };

        if (carrier) {
            const playerRect = { x: carrier.pos.x - 15, y: carrier.pos.y - carrier.height, w: 30, h: carrier.height };
            if (checkRectOverlap(playerRect, extractionRect)) {
                state.scores[Team.BLUE] += 1;
                carrier.hasFlag = Team.NONE;
                if (intel) {
                    intel.active = false;
                }
                emitText(carrier.pos.x, carrier.pos.y - 40, 'EXTRACTED', '#facc15');
                emitFlag('intel', 'captured');
                state.infiltrationEndTime = now + INFILTRATION_TIMER;
                state.pickups = state.pickups.filter(p => p.type !== ItemType.INTEL);
                state.pickups.push({
                    id: nextId('intel_'),
                    type: ItemType.INTEL,
                    team: Team.RED,
                    pos: { ...INTEL_POS },
                    active: true,
                    respawnTime: -1,
                    value: 1000
                });
            }
        }

        if (state.infiltrationEndTime && now > state.infiltrationEndTime) {
            state.scores[Team.RED] += 1;
            state.infiltrationEndTime = now + INFILTRATION_TIMER;
            state.players.forEach(p => { if (p.hasFlag === Team.RED) p.hasFlag = Team.NONE; });
            state.pickups = state.pickups.filter(p => p.type !== ItemType.INTEL);
            state.pickups.push({
                id: nextId('intel_'),
                type: ItemType.INTEL,
                team: Team.RED,
                pos: { ...INTEL_POS },
                active: true,
                respawnTime: -1,
                value: 1000
            });
        }
    }

    // Visual and non-gameplay physics updates
    updateParticles(state);
    updateFloatingTexts(state);
    updateDecals(state, now);
    updateCorpses(state);

    if (state.mode === GameMode.HUNGER_GAMES) updateHungerRound(state, now);
    updateMatch(state, now);

    followCamera(state, pickCameraTarget(state, localPlayerId));
};
