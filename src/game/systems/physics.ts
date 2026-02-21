import { GameState, Entity, Platform, Vector2, WeaponType, ItemType, GameMode, Team, PlayerInput, RagdollPart } from '../../types';
import { GRAVITY, FRICTION, AIR_RESISTANCE, MOVE_SPEED, CROUCH_SPEED, JUMP_FORCE, JETPACK_FORCE, JETPACK_CONSUMPTION, JETPACK_RECHARGE, MAX_SPEED, DASH_COOLDOWN, DASH_FORCE, HOOK_PULL_FORCE, HOOK_RANGE, WEAPONS_DATA, ITEMS_DATA, RESPAWN_DELAY, ITEM_RESPAWN_TIME, HTF_SCORE_INTERVAL, HTF_WIN_SCORE, INFILTRATION_TIMER, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../../constants';
import { gameEvents } from './events';
import { nextId } from '../utils/id';
import { updateBotAI } from './bot';
import { distance, normalize, checkPointInRect, checkRectOverlap, segmentIntersectsRect } from '../utils/math';
import { baseFlagPos, HTF_FLAG_POS, EXTRACTION_ZONE, INTEL_POS } from '../data/level';
import { trackKill, trackFlagCapture, trackFlagHoldTime, trackDoubleJump, trackHookUse, trackDashUse, trackItemPickup } from './achievements';

import { resetFlagToBase, applyGunGameLoadout } from './gamemodes';
import { applyDamage, fireWeapon, createParticles, resolveCollision, castRay, createExplosion } from './combat';
import { updateParticles, updateFloatingTexts, updateDecals, updateRagdolls } from './particles';

// Extracted combat logic is now imported from combat.ts

// --- MAIN PHYSICS UPDATE LOOP ---
export const updatePhysics = (state: GameState, keys: any, mouse: any, hookPressed: boolean, mousePressed: boolean, screenW: number, screenH: number, getSpawnPoint: any, localPlayerId: string, remoteInputs?: Record<string, PlayerInput>) => {
    const now = Date.now();

    // Respawn
    state.players.forEach(p => {
        if (p.dead) {
            if (state.mode === GameMode.HUNGER_GAMES) return;
            if (now > p.respawnTimer) {
                if (state.mode === GameMode.CTF || state.mode === GameMode.HOLD_THE_FLAG) {
                    const blueCount = state.players.filter(pl => pl.team === Team.BLUE).length;
                    const redCount = state.players.filter(pl => pl.team === Team.RED).length;
                    if (Math.abs(blueCount - redCount) > 1) {
                        const disadvantaged = blueCount < redCount ? Team.BLUE : Team.RED;
                        state.scores[disadvantaged] += 1;
                    }
                }
                p.dead = false; p.health = 100; p.armor = 0; p.jetpackFuel = 100;
                p.pos = getSpawnPoint(p.team); p.vel = { x: 0, y: 0 };
                if (state.mode === GameMode.GUN_GAME) {
                    applyGunGameLoadout(p, p.gunLevel || 0);
                } else {
                    p.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }];
                    p.weapon = p.inventory[0];
                }
                p.hasFlag = Team.NONE;
                createParticles(state, p.pos.x, p.pos.y, 20, '#ffffff', 'spark');
            }
        }
    });

    // Hunger Games shrinking zone damage
    if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone) {
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
        let inputX = 0;
        let isFlying = false;
        let aimTarget = { x: p.pos.x, y: p.pos.y };

        // Determine inputs
        let pKeys = keys;
        let pMouse = mouse;
        let pMousePressed = mousePressed;
        let pHookPressed = hookPressed;
        let isLocal = p.id === localPlayerId;
        let isRemote = remoteInputs && remoteInputs[p.id];

        if (isRemote) {
            const input = remoteInputs![p.id];
            pKeys = input.keys;
            pMouse = input.mouse;
            pMousePressed = input.mousePressed;
            pHookPressed = input.hookPressed;
        }

        if (p.type === 'player') {
            // Logic for both Local and Remote players
            // If remote, we use the inputs passed in

            const wantsJump = !!(pKeys['Space'] || pKeys['KeyW']);
            p.isCrouching = !!pKeys['KeyS'];
            if (pKeys['KeyA']) inputX -= 1;
            if (pKeys['KeyD']) inputX += 1;
            if (wantsJump && p.jetpackFuel > 0) isFlying = true;

            // Aim Calibrated to Screen
            // For remote players, the mouse position sent is likely screen coordinates relative to THEIR camera?
            // Wait, if I send mouse.x/y from client, it is screen coordinates.
            // But the host has a different camera position.
            // We need to convert screen coordinates to WORLD coordinates on the client before sending.
            // OR, we assume the client sends WORLD coordinates.

            // Let's assume for now client sends SCREEN coordinates (as it does currently in GameCanvas).
            // But wait, GameCanvas sends `mouse.current` which is `e.clientX`.
            // So it is screen coordinates.
            // But `updatePhysics` expects `mouse` to be screen coordinates and converts to world using `state.camera`.
            // This is wrong for remote players because `state.camera` is the HOST's camera.

            // FIX: Clients should send WORLD coordinates.
            // But I can't change the client sending code easily without changing `PlayerInput` semantics.
            // Actually, let's look at `GameCanvas` again.
            // In `GameCanvas`, for local player: `mouse.current` is updated via `mousemove`.
            // In `updatePhysics`: `const worldMouseX = (mouse.x - cx) + state.camera.x;`

            // So for remote players, if they send screen coords, we are using HOST camera to unproject, which is wrong.
            // We need to change `GameCanvas` to send WORLD coordinates, or `updatePhysics` to handle this.
            // It's better if `PlayerInput` contains WORLD coordinates for aim.
            // But `PlayerInput` has `mouse: {x, y}`.

            // Let's assume for this iteration that we will fix `GameCanvas` to send world coords, 
            // OR we just accept that for now we might have aiming issues and fix it in the next step.
            // Actually, I can fix `GameCanvas` right after this. 
            // So let's write `updatePhysics` assuming `pMouse` is in WORLD coordinates for remote players?
            // No, `updatePhysics` logic for local player (lines 295-298) does the conversion.

            // Let's change `updatePhysics` to expect `mouse` to be:
            // - Local: Screen coords (needs conversion)
            // - Remote: World coords (already converted)

            let worldMouseX, worldMouseY;

            if (isLocal) {
                const cx = screenW / 2;
                const cy = screenH / 2;
                worldMouseX = (pMouse.x - cx) + state.camera.x;
                worldMouseY = (pMouse.y - cy) + state.camera.y;
            } else {
                // Assume remote sends world coords (we will ensure this in GameCanvas)
                worldMouseX = pMouse.x;
                worldMouseY = pMouse.y;
            }

            if (pMousePressed && now - p.lastFired > p.weapon.fireRate) {
                fireWeapon(state, p, { x: worldMouseX, y: worldMouseY });
            }

            // Grapple Aim
            if (pHookPressed && !p.grapple.active) {
                const dir = normalize({ x: worldMouseX - p.pos.x, y: worldMouseY - p.pos.y });
                const hit = castRay(state, { x: p.pos.x, y: p.pos.y }, dir, HOOK_RANGE);
                if (hit) {
                    p.grapple.active = true;
                    p.grapple.pos = hit;
                    p.grapple.length = distance(p.pos, hit);

                    // Track achievement for hook usage
                    if (p.type === 'player') {
                        trackHookUse();
                    }
                }
            } else if (!pHookPressed) p.grapple.active = false;

            if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team && wantsJump && p.isCrouching) {
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
            }

        } else {
            // BOT AI вынесен в отдельный модуль, чтобы гарантировать движение/стрельбу
            isFlying = updateBotAI(p, state, now, (bot, target) => fireWeapon(state, bot, target), state.mode);
        }

        // Common Physics
        p.vel.y += GRAVITY;
        p.vel.y = Math.min(p.vel.y, 7.5); // Terminal velocity (медленнее падение)
        p.vel.y = Math.max(p.vel.y, -7); // ограничение вверх, чтобы не улетать слишком быстро

        if (p.type === 'player') {
            const speed = p.isCrouching ? CROUCH_SPEED : (p.isGrounded ? MOVE_SPEED : MOVE_SPEED * 0.5);
            p.vel.x += inputX * speed;
            p.height = p.isCrouching ? 45 : 72;
        }

        // Jetpack (works for both player and bots)
        if (isFlying) {
            p.vel.y += JETPACK_FORCE;
            p.jetpackFuel = Math.max(0, p.jetpackFuel - JETPACK_CONSUMPTION);
            if (Math.random() < 0.5) createParticles(state, p.pos.x - 12, p.pos.y + 18, 1, '#fbbf24', 'fire');
        } else if (p.isGrounded || p.grapple.active) {
            p.jetpackFuel = Math.min(p.maxFuel, p.jetpackFuel + JETPACK_RECHARGE);
        }

        // Grapple (player only for now)
        if (p.type === 'player' && p.grapple.active) {
            const dir = normalize({ x: p.grapple.pos.x - p.pos.x, y: p.grapple.pos.y - p.pos.y });
            const dist = distance(p.pos, p.grapple.pos);
            if (dist > 40) {
                p.vel.x += dir.x * HOOK_PULL_FORCE * 20;
                p.vel.y += dir.y * HOOK_PULL_FORCE * 20;
                p.vel.y -= GRAVITY * 0.6;
            }
        }

        if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team) {
            p.vel.x *= 0.85;
        }

        // Apply friction and movement (ALL entities)
        p.vel.x *= (p.isGrounded ? FRICTION : AIR_RESISTANCE);
        // Soft clamp: allow exceeding MAX_SPEED slightly but decay faster
        if (Math.abs(p.vel.x) > MAX_SPEED) p.vel.x *= 0.95;
        // Hard clamp only for extreme values
        p.vel.x = Math.max(-MAX_SPEED * 2, Math.min(MAX_SPEED * 2, p.vel.x));
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.isGrounded = false;

        // Верхняя граница карты
        if (p.pos.y < -500) {
            p.pos.y = -500;
            if (p.vel.y < 0) p.vel.y = 0;
        }

        state.platforms.forEach(plat => resolveCollision(p, plat));

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
            // Item hitbox: flags are tall (pole + cloth), others are small cubes
            const itemW = item.type === ItemType.FLAG ? 80 : 40;
            const itemH = item.type === ItemType.FLAG ? 100 : 40;
            const itemRect = { x: item.pos.x - itemW / 2, y: item.pos.y - itemH, w: itemW, h: itemH };
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
                if (item.type === ItemType.HEALTH && p.health < 100) { p.health = Math.min(100, p.health + item.value); collected = true; }
                else if (item.type === ItemType.ARMOR && p.armor < 100) { p.armor = Math.min(100, p.armor + item.value); collected = true; }
                else if (item.type === ItemType.AMMO) { p.inventory.forEach(w => w.ammo = Math.min(w.maxAmmo, w.ammo + item.value)); collected = true; }
                else if (item.type === ItemType.WEAPON) {
                    // Gun Game disables weapon pickups to preserve ladder progression
                    if (state.mode !== GameMode.GUN_GAME) {
                        const has = p.inventory.find(w => w.type === item.subtype);
                        if (has) has.ammo += 10; else if (item.subtype) p.inventory.push({ ...WEAPONS_DATA[item.subtype] });
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
                        state.floatingTexts.push({
                            id: nextId('ft_'),
                            pos: { ...p.pos, y: p.pos.y - 30 },
                            text: 'GRABBED',
                            color: '#facc15',
                            life: 1,
                            velY: 1
                        });
                        gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
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
                        }
                    } else {
                        if (item.team !== p.team && item.active) {
                            item.active = false;
                            item.respawnTime = 0;
                            p.hasFlag = item.team!;
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
                        } else if (p.hasFlag !== Team.NONE) {
                            // Захват: приносим в свою базу
                            state.scores[p.team]++;
                            resetFlagToBase(state, p.hasFlag);
                            p.hasFlag = Team.NONE;
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });

                            // Track achievement for flag capture
                            trackFlagCapture();
                        } else if (!item.active) {
                            // Ничего — флаг временно унесен
                        } else if (Math.abs(item.pos.x - (item.team === Team.BLUE ? -350 : 2350)) > 100) {
                            resetFlagToBase(state, item.team!);
                            gameEvents.emit({ type: 'SOUND', sound: 'pickup' });
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

                // Track achievement for item pickup
                if (collected && p.type === 'player') {
                    trackItemPickup();
                }
            }
        });
    });

    // Projectiles Update
    state.projectiles.forEach(proj => {
        const prevPos = { ...proj.pos };
        proj.pos.x += proj.vel.x; proj.pos.y += proj.vel.y;
        if (proj.type === WeaponType.ROCKET_LAUNCHER) { proj.vel.y += 0.1; if (Math.random() < 0.5) createParticles(state, proj.pos.x, proj.pos.y, 1, '#9ca3af', 'smoke'); }
        if (proj.type === WeaponType.GRENADE_LAUNCHER) { proj.vel.y += 0.25; proj.life = (proj.life || 0) - 1; }

        let hit = false;
        state.platforms.forEach(plat => {
            if (checkPointInRect(proj.pos, plat) || segmentIntersectsRect(prevPos, proj.pos, plat)) hit = true;
        });
        if (!hit) {
            state.players.forEach(p => {
                if (p.id !== proj.ownerId && !p.dead) {
                    // Friendly Fire Check: Pass through teammates
                    const owner = state.players.find(o => o.id === proj.ownerId);
                    if (owner && owner.team !== Team.NONE && p.team !== Team.NONE && owner.team === p.team) {
                        return; // Ignore collision with teammate
                    }

                    const rect = { x: p.pos.x - 15, y: p.pos.y - p.height, w: 30, h: p.height };
                    if (checkPointInRect(proj.pos, rect) || segmentIntersectsRect(prevPos, proj.pos, rect)) {
                        hit = true; applyDamage(state, p, proj.ownerId, WEAPONS_DATA[proj.type].damage, proj.vel);
                    }
                }
            });
        }
        if (proj.type === WeaponType.GRENADE_LAUNCHER && (proj.life || 0) <= 0) hit = true;

        if (hit) {
            proj.active = false;
            if (proj.type === WeaponType.ROCKET_LAUNCHER || proj.type === WeaponType.GRENADE_LAUNCHER) {
                createExplosion(state, proj.pos, proj.ownerId, 150);
            } else {
                gameEvents.emit({ type: 'SOUND', sound: 'hit' });
            }
            createParticles(state, proj.pos.x, proj.pos.y, 8, WEAPONS_DATA[proj.type].color, 'spark');
        }
    });
    state.projectiles = state.projectiles.filter(p => p.active);

    // Beams Update
    if (!state.beams) state.beams = [];
    state.beams.forEach(beam => {
        beam.life -= 0.05; // Fade out speed
    });
    state.beams = state.beams.filter(b => b.life > 0);

    // Hold The Flag scoring tick
    if (state.mode === GameMode.HOLD_THE_FLAG) {
        const holder = state.players.find(p => !p.dead && p.hasFlag === p.team && p.team !== Team.NONE);
        if (holder && now - (state.lastHTFScore || 0) >= HTF_SCORE_INTERVAL) {
            state.scores[holder.team] += 1;
            state.lastHTFScore = now;
            state.floatingTexts.push({
                id: nextId('ft_'),
                pos: { ...holder.pos, y: holder.pos.y - 20 },
                text: '+1',
                color: '#22c55e',
                life: 1,
                velY: 1
            });
            gameEvents.emit({ type: 'SOUND', sound: 'score' });
            if (state.scores[holder.team] >= HTF_WIN_SCORE) {
                // TODO: surface victory screen/state; for now just clamp
                state.scores[holder.team] = HTF_WIN_SCORE;
            }
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
                state.floatingTexts.push({
                    id: nextId('ft_'),
                    pos: { ...carrier.pos, y: carrier.pos.y - 40 },
                    text: 'EXTRACTED',
                    color: '#facc15',
                    life: 1,
                    velY: 1
                });
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
    updateRagdolls(state);

    if (state.mode === GameMode.HUNGER_GAMES) {
        const alive = state.players.filter(p => !p.dead);
        if (alive.length === 1) {
            state.hungerWinnerId = alive[0].id;
        }
    }

    // Camera
    let cameraTarget = state.players[0];
    if (state.mode === GameMode.HUNGER_GAMES && state.players.length) {
        // Spectate bet target if exists
        const betTargetId = (state as any).betSpectateId as string | undefined;
        if (betTargetId) {
            const found = state.players.find(p => p.id === betTargetId && !p.dead);
            if (found) cameraTarget = found;
        } else if (state.hungerWinnerId) {
            const winner = state.players.find(p => p.id === state.hungerWinnerId);
            if (winner) cameraTarget = winner;
        }
    }
    if (cameraTarget) {
        const targetX = cameraTarget.pos.x;
        const targetY = cameraTarget.pos.y - 50;
        const smoothing = state.mode === GameMode.HUNGER_GAMES ? 0.2 : 0.12;
        state.camera.x += (targetX - state.camera.x) * smoothing;
        state.camera.y += (targetY - state.camera.y) * smoothing;
    }
};
