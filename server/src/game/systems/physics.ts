import { GameState, Entity, Platform, Vector2, WeaponType, ItemType, GameMode, Team, PlayerInput, RagdollPart, Pickup, Weapon, Projectile, Particle, FloatingText, Decal } from '../../types.js';
import { GRAVITY, FRICTION, AIR_RESISTANCE, MOVE_SPEED, CROUCH_SPEED, JUMP_FORCE, JETPACK_FORCE, JETPACK_CONSUMPTION, JETPACK_RECHARGE, MAX_SPEED, DASHE_COOLDOWN, DASH_FORCE, HOOK_PULL_FORCE, HOOK_RANGE, WEAPONS_DATA, ITEMS_DATA, RESPAWN_DELAY, ITEM_RESPAWN_TIME, HTF_SCORE_INTERVAL, HTF_WIN_SCORE, INFILTRATION_TIMER } from '../../constants.js';
import { playSound } from './audio.js';
import { updateBotAI } from './bot.js';
import { distance, normalize, checkPointInRect, checkRectOverlap, segmentIntersectsRect } from '../utils/math.js';
import { baseFlagPos, HTF_FLAG_POS, EXTRACTION_ZONE, INTEL_POS } from '../data/level.js';

const resetFlagToBase = (state: GameState, team: Team) => {
    const flag = state.pickups.find((i: Pickup) => i.type === ItemType.FLAG && i.team === team);
    if (flag) {
        flag.active = true;
        flag.respawnTime = 0;
        flag.pos = baseFlagPos(team);
    }
};

const createRagdoll = (state: GameState, entity: Entity) => {
    const baseVel = { ...entity.vel };
    const randomForce = () => (Math.random() - 0.5) * 8;

    const parts: RagdollPart[] = [
        {
            id: `${entity.id}_head_${Date.now()}`,
            type: 'head',
            pos: { x: entity.pos.x, y: entity.pos.y - 60 },
            vel: { x: baseVel.x + randomForce(), y: baseVel.y - 3 + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.3,
            color: entity.color,
            life: 5,
            isGrounded: false
        },
        {
            id: `${entity.id}_torso_${Date.now()}`,
            type: 'torso',
            pos: { x: entity.pos.x, y: entity.pos.y - 35 },
            vel: { x: baseVel.x + randomForce(), y: baseVel.y + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.25,
            color: entity.color,
            life: 5,
            isGrounded: false
        },
        {
            id: `${entity.id}_arm_l_${Date.now()}`,
            type: 'arm-left',
            pos: { x: entity.pos.x - 10, y: entity.pos.y - 40 },
            vel: { x: baseVel.x - 4 + randomForce(), y: baseVel.y + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.4,
            color: entity.color,
            life: 5,
            isGrounded: false
        },
        {
            id: `${entity.id}_arm_r_${Date.now()}`,
            type: 'arm-right',
            pos: { x: entity.pos.x + 10, y: entity.pos.y - 40 },
            vel: { x: baseVel.x + 4 + randomForce(), y: baseVel.y + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.4,
            color: entity.color,
            life: 5,
            isGrounded: false
        },
        {
            id: `${entity.id}_leg_l_${Date.now()}`,
            type: 'leg-left',
            pos: { x: entity.pos.x - 8, y: entity.pos.y - 15 },
            vel: { x: baseVel.x - 3 + randomForce(), y: baseVel.y + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.35,
            color: entity.color,
            life: 5,
            isGrounded: false
        },
        {
            id: `${entity.id}_leg_r_${Date.now()}`,
            type: 'leg-right',
            pos: { x: entity.pos.x + 8, y: entity.pos.y - 15 },
            vel: { x: baseVel.x + 3 + randomForce(), y: baseVel.y + randomForce() },
            rotation: Math.random() * Math.PI * 2,
            angularVel: (Math.random() - 0.5) * 0.35,
            color: entity.color,
            life: 5,
            isGrounded: false
        }
    ];

    state.ragdollParts.push(...parts);
};

// Physics Functions
export const createParticles = (state: GameState, x: number, y: number, count: number, color: string, type: 'blood' | 'spark' | 'smoke' | 'fire' | 'shell' = 'spark') => {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            id: Math.random().toString(),
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

const castRay = (state: GameState, start: Vector2, dir: Vector2, range: number): Vector2 | null => {
    let c = { x: start.x, y: start.y }, d = 0;
    while (d < range) { c.x += dir.x * 10; c.y += dir.y * 10; d += 10; for (const p of state.platforms) if (checkPointInRect(c, p)) return { ...c }; }
    return null;
};

const resolveCollision = (p: Entity, plat: Platform) => {
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

const applyDamage = (state: GameState, target: Entity, attackerId: string, amount: number, knockback: Vector2, setKillFeed: any, isMuted: boolean) => {
    if (target.dead) return;
    const holdingHTF = state.mode === GameMode.HOLD_THE_FLAG && target.hasFlag === target.team;
    let dmg = holdingHTF ? amount * 1.1 : amount;
    if (target.armor > 0) {
        const absorb = Math.min(target.armor, dmg * 0.66);
        target.armor -= absorb;
        dmg -= absorb;
    }
    target.health -= dmg;

    const len = Math.sqrt(knockback.x * knockback.x + knockback.y * knockback.y) || 1;
    target.vel.x += (knockback.x / len) * (amount / 10);
    target.vel.y += (knockback.y / len) * (amount / 10);

    state.floatingTexts.push({
        id: Math.random().toString(), pos: { ...target.pos, y: target.pos.y - 40 },
        text: Math.round(dmg).toString(), color: '#ef4444', life: 1, velY: 1
    });

    if (target.health <= 0) {
        target.dead = true;
        target.respawnTimer = Date.now() + RESPAWN_DELAY;
        createParticles(state, target.pos.x, target.pos.y, 40, target.color, 'blood');
        // Decal (Blood)
        state.decals.push({
            id: Math.random().toString(), pos: { x: target.pos.x, y: target.pos.y + 20 },
            rotation: Math.random() * Math.PI * 2, scale: 1 + Math.random(), color: 0x7f1d1d, alpha: 0.8
        });

        // Create Ragdoll instead of static corpse
        createRagdoll(state, target);

        // Если игрок нес флаг — вернуть его на базу команды флага или дропнуть
        if (target.hasFlag !== Team.NONE) {
            if (state.mode === GameMode.HOLD_THE_FLAG && target.hasFlag === target.team) {
                const dropId = `htf_drop_${Date.now()}`;
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
                    id: `intel_drop_${Date.now()}`,
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
            const killer = state.players.find((p: Entity) => p.id === attackerId);
            if (setKillFeed) {
                setKillFeed((prev: any) => [...prev.slice(-4), {
                    id: Math.random().toString(),
                    killer: killer ? killer.name : 'World',
                    killerColor: killer ? killer.color : '#ffffff',
                    weapon: killer ? killer.weapon.name : 'Environment',
                    victim: target.name,
                    victimColor: target.color
                }]);
            }
            // Award score
            if (killer) {
                if (state.mode !== GameMode.CTF) {
                    // Deathmatch: increment personal score and team score for kills
                    killer.score++;
                } else if (killer.team !== target.team) {
                    // CTF: only increment personal score for kills
                    // Team score is incremented only on flag captures (line 343)
                    killer.score += 100;
                }
            }
        }
    }
};

const createExplosion = (state: GameState, pos: Vector2, ownerId: string, radius: number, setKillFeed: any, isMuted: boolean) => {
    createParticles(state, pos.x, pos.y, 20, '#f97316', 'fire');
    createParticles(state, pos.x, pos.y, 10, '#ffffff', 'smoke');
    playSound('explosion', undefined, isMuted);

    state.players.forEach((p: Entity) => {
        const dist = distance(pos, p.pos);
        if (dist < radius) {
            const dmg = 100 * (1 - dist / radius);
            applyDamage(state, p, ownerId, dmg, { x: p.pos.x - pos.x, y: p.pos.y - pos.y }, setKillFeed, isMuted);
        }
    });
};

const fireWeapon = (state: GameState, p: Entity, target: Vector2, isMuted: boolean, setKillFeed: any) => {
    if (p.weapon.ammo <= 0) return;
    p.weapon.ammo--;
    p.lastFired = Date.now();

    const crouchY = p.isCrouching ? 15 : 0;
    // Fire Origin: Align with visual shoulder (approx -50 from feet)
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

        // Check players
        state.players.forEach((target: Entity) => {
            if (target.id === p.id || target.dead) return;
            const rect = { x: target.pos.x - 15, y: target.pos.y - target.height, w: 30, h: target.height };
            if (segmentIntersectsRect(origin, end, rect)) {
                const d = distance(origin, target.pos);
                if (d < closest) { closest = d; hitPlayer = target; hitPos = { x: origin.x + dir.x * d, y: origin.y + dir.y * d }; }
            }
        });

        // Check platforms for blocking
        state.platforms.forEach((plat: Platform) => {
            if (segmentIntersectsRect(origin, end, plat)) {
                const d = distance(origin, { x: plat.x, y: plat.y });
                if (d < closest) { closest = d; hitPlayer = null; hitPos = { x: origin.x + dir.x * d, y: origin.y + dir.y * d }; }
            }
        });

        if (hitPlayer) {
            applyDamage(state, hitPlayer, p.id, WEAPONS_DATA[WeaponType.RAILGUN].damage, dir, setKillFeed, isMuted);
        }

        createParticles(state, hitPos.x, hitPos.y, 10, '#38bdf8', 'spark');
        return;
    }

    if (p.weapon.type === WeaponType.CHAINSAW) {
        const reach = 70;
        const attackPos = { x: origin.x + dir.x * reach, y: origin.y + dir.y * reach };
        state.players.forEach((target: Entity) => {
            if (target.id === p.id || target.dead) return;
            const dist = distance(attackPos, target.pos);
            if (dist < 60) {
                applyDamage(state, target, p.id, WEAPONS_DATA[WeaponType.CHAINSAW].damage, dir, setKillFeed, isMuted);
                createParticles(state, target.pos.x, target.pos.y - 20, 6, '#ef4444', 'blood');
            }
        });
        createParticles(state, attackPos.x, attackPos.y, 8, '#ef4444', 'spark');
        playSound('shoot', p.weapon.type, isMuted);
        return;
    }

    const createProj = (spread = 0) => {
        const a = angle + spread;
        state.projectiles.push({
            id: Math.random().toString(), ownerId: p.id,
            pos: { x: origin.x + dir.x * 20, y: origin.y + dir.y * 20 },
            vel: { x: Math.cos(a) * p.weapon.speed, y: Math.sin(a) * p.weapon.speed },
            type: p.weapon.type, radius: 4, active: true,
            life: p.weapon.type === WeaponType.GRENADE_LAUNCHER ? 60 : undefined
        });
    }

    if (p.weapon.type === WeaponType.PLASMA_GUN) {
        // Plasma Gun: Fast projectile, no spread, high speed
        createProj(0);
        playSound('shoot', p.weapon.type, isMuted);
        return;
    }

    if (p.weapon.type === WeaponType.SHOTGUN) {
        for (let i = 0; i < 6; i++) createProj((Math.random() - 0.5) * 0.3);
    } else {
        createProj(0);
    }

    playSound('shoot', p.weapon.type, isMuted);
    state.particles.push({
        id: Math.random().toString(), pos: { x: origin.x, y: origin.y },
        vel: { x: (Math.random() - 0.5) * 4, y: -2 - Math.random() * 2 },
        life: 1, decay: 0.05, color: '#fbbf24', size: 3, type: 'shell', rotation: Math.random() * Math.PI
    });
};

// --- MAIN PHYSICS UPDATE LOOP ---
export const updatePhysics = (state: GameState, keys: any, mouse: any, hookPressed: boolean, mousePressed: boolean, screenW: number, screenH: number, setKillFeed: any, isMuted: boolean, getSpawnPoint: any, localPlayerId: string, remoteInputs?: Record<string, PlayerInput>) => {
    const now = Date.now();

    // Respawn
    state.players.forEach((p: Entity) => {
        if (p.dead) {
            if (now > p.respawnTimer) {
                if (state.mode === GameMode.CTF || state.mode === GameMode.HOLD_THE_FLAG) {
                    const blueCount = state.players.filter((pl: Entity) => pl.team === Team.BLUE).length;
                    const redCount = state.players.filter((pl: Entity) => pl.team === Team.RED).length;
                    if (Math.abs(blueCount - redCount) > 1) {
                        const disadvantaged = blueCount < redCount ? Team.BLUE : Team.RED;
                        state.scores[disadvantaged] += 1;
                    }
                }
                p.dead = false; p.health = 100; p.armor = 0; p.jetpackFuel = 100;
                p.pos = getSpawnPoint(p.team); p.vel = { x: 0, y: 0 };
                p.inventory = [{ ...WEAPONS_DATA[WeaponType.MACHINE_GUN] }];
                p.weapon = p.inventory[0];
                p.hasFlag = Team.NONE;
                createParticles(state, p.pos.x, p.pos.y, 20, '#ffffff', 'spark');
            }
        }
    });

    // Гарантируем наличие флагов в CTF (на случай пустого массива)
    if (state.mode === GameMode.CTF && !state.pickups.some((p: Pickup) => p.type === ItemType.FLAG)) {
        state.pickups.push(
            { id: 'flag_blue', type: ItemType.FLAG, team: Team.BLUE, pos: baseFlagPos(Team.BLUE), active: true, respawnTime: 0, value: 0 },
            { id: 'flag_red', type: ItemType.FLAG, team: Team.RED, pos: baseFlagPos(Team.RED), active: true, respawnTime: 0, value: 0 }
        );
    }
    if (state.mode === GameMode.HOLD_THE_FLAG && !state.pickups.some((p: Pickup) => p.type === ItemType.FLAG)) {
        state.pickups.push({
            id: `htf_flag_${Date.now()}`,
            type: ItemType.FLAG,
            team: Team.NONE,
            pos: { ...HTF_FLAG_POS },
            active: true,
            respawnTime: 0,
            value: 0
        });
    }
    if (state.mode === GameMode.INFILTRATION && !state.pickups.some((p: Pickup) => p.type === ItemType.INTEL)) {
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
    state.pickups.forEach((item: Pickup) => {
        if (!item.active && item.type !== ItemType.FLAG && item.type !== ItemType.INTEL && now > item.respawnTime) item.active = true;
        else if (!item.active && item.type === ItemType.FLAG && now > item.respawnTime && item.respawnTime > 0) {
            item.active = true;
            item.pos = baseFlagPos(item.team || Team.BLUE);
        }
    });

    // Players Logic
    state.players.forEach((p: Entity) => {
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

        const input = remoteInputs![p.id];
        pKeys = input.keys;
        pMouse = input.mouse;
        pMousePressed = input.mousePressed;
        pHookPressed = input.hookPressed;
        if (input) p.lastProcessedInput = input.sequence;

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
                fireWeapon(state, p, { x: worldMouseX, y: worldMouseY }, isMuted, setKillFeed);
            }

            // Grapple Aim
            if (pHookPressed && !p.grapple.active) {
                const dir = normalize({ x: worldMouseX - p.pos.x, y: worldMouseY - p.pos.y });
                const hit = castRay(state, { x: p.pos.x, y: p.pos.y }, dir, HOOK_RANGE);
                if (hit) { p.grapple.active = true; p.grapple.pos = hit; p.grapple.length = distance(p.pos, hit); }
            } else if (!pHookPressed) p.grapple.active = false;

            if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team && wantsJump && p.isCrouching) {
                state.pickups.push({
                    id: `htf_throw_${Date.now()}`,
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
            isFlying = updateBotAI(p, state, now, (bot: Entity, target: Vector2) => fireWeapon(state, bot, target, isMuted, setKillFeed), state.mode);
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

        state.platforms.forEach((plat: Platform) => resolveCollision(p, plat));

        // Map Bounds Death (ALL entities)
        if (p.pos.y > 2500) applyDamage(state, p, '', 9999, { x: 0, y: 0 }, setKillFeed, isMuted);

        // Item Collection (ALL entities)
        state.pickups.forEach((item: Pickup) => {
            // Item hitbox: flags are tall (pole + cloth), others are small cubes
            const itemW = item.type === ItemType.FLAG ? 80 : 40;
            const itemH = item.type === ItemType.FLAG ? 100 : 40;
            const itemRect = { x: item.pos.x - itemW / 2, y: item.pos.y - itemH, w: itemW, h: itemH };
            const playerRect = { x: p.pos.x - 15, y: p.pos.y - p.height, w: 30, h: p.height };

            if (item.active && checkRectOverlap(itemRect, playerRect)) {
                let collected = false;
                if (item.type === ItemType.HEALTH && p.health < 100) { p.health = Math.min(100, p.health + item.value); collected = true; }
                else if (item.type === ItemType.ARMOR && p.armor < 100) { p.armor = Math.min(100, p.armor + item.value); collected = true; }
                else if (item.type === ItemType.AMMO) { p.inventory.forEach((w: Weapon) => w.ammo = Math.min(w.maxAmmo, w.ammo + item.value)); collected = true; }
                else if (item.type === ItemType.WEAPON) {
                    // Gun Game: hard-block weapon pickups entirely
                    if (state.mode === GameMode.GUN_GAME) {
                        item.active = false;
                        item.respawnTime = Number.MAX_SAFE_INTEGER;
                        return;
                    }
                    const has = p.inventory.find((w: Weapon) => w.type === item.subtype);
                    if (has) has.ammo += 10; else if (item.subtype) p.inventory.push({ ...WEAPONS_DATA[item.subtype] });
                    // Don't auto-switch weapon - let player choose
                    collected = true;
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
                            id: Math.random().toString(),
                            pos: { ...p.pos, y: p.pos.y - 30 },
                            text: 'GRABBED',
                            color: '#facc15',
                            life: 1,
                            velY: 1
                        });
                        playSound('pickup', undefined, isMuted);
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
                            playSound('pickup', undefined, isMuted);
                        } else if (p.hasFlag !== Team.NONE) {
                            // Захват: приносим в свою базу
                            state.scores[p.team]++;
                            resetFlagToBase(state, p.hasFlag);
                            p.hasFlag = Team.NONE;
                            playSound('pickup', undefined, isMuted);
                        } else if (!item.active) {
                            // Ничего — флаг временно унесен
                        } else if (Math.abs(item.pos.x - (item.team === Team.BLUE ? -350 : 2350)) > 100) {
                            resetFlagToBase(state, item.team!);
                            playSound('pickup', undefined, isMuted);
                        }
                    }
                }
                if (collected) {
                    if (item.type !== ItemType.FLAG) {
                        item.active = false;
                        item.respawnTime = Date.now() + ITEM_RESPAWN_TIME;
                    }
                    playSound('pickup', undefined, isMuted);
                }
            }
        });
    });

    // Projectiles Update
    state.projectiles.forEach((proj: Projectile) => {
        const prevPos = { ...proj.pos };
        proj.pos.x += proj.vel.x; proj.pos.y += proj.vel.y;
        if (proj.type === WeaponType.ROCKET_LAUNCHER) { proj.vel.y += 0.1; if (Math.random() < 0.5) createParticles(state, proj.pos.x, proj.pos.y, 1, '#9ca3af', 'smoke'); }
        if (proj.type === WeaponType.GRENADE_LAUNCHER) { proj.vel.y += 0.25; proj.life = (proj.life || 0) - 1; }

        let hit = false;
        state.platforms.forEach((plat: Platform) => {
            if (checkPointInRect(proj.pos, plat) || segmentIntersectsRect(prevPos, proj.pos, plat)) hit = true;
        });
        if (!hit) {
            state.players.forEach((p: Entity) => {
                if (p.id !== proj.ownerId && !p.dead) {
                    // Friendly Fire Check: Pass through teammates
                    const owner = state.players.find((o: Entity) => o.id === proj.ownerId);
                    if (owner && owner.team !== Team.NONE && p.team !== Team.NONE && owner.team === p.team) {
                        return; // Ignore collision with teammate
                    }

                    const rect = { x: p.pos.x - 15, y: p.pos.y - p.height, w: 30, h: p.height };
                    if (checkPointInRect(proj.pos, rect) || segmentIntersectsRect(prevPos, proj.pos, rect)) {
                        hit = true; applyDamage(state, p, proj.ownerId, WEAPONS_DATA[proj.type].damage, proj.vel, setKillFeed, isMuted);
                    }
                }
            });
        }
        if (proj.type === WeaponType.GRENADE_LAUNCHER && (proj.life || 0) <= 0) hit = true;

        if (hit) {
            proj.active = false;
            if (proj.type === WeaponType.ROCKET_LAUNCHER || proj.type === WeaponType.GRENADE_LAUNCHER) {
                createExplosion(state, proj.pos, proj.ownerId, 150, setKillFeed, isMuted);
            } else {
                playSound('hit', undefined, isMuted);
            }
            createParticles(state, proj.pos.x, proj.pos.y, 8, WEAPONS_DATA[proj.type].color, 'spark');
        }
    });
    state.projectiles = state.projectiles.filter((p: Projectile) => p.active);

    // Hold The Flag scoring tick
    if (state.mode === GameMode.HOLD_THE_FLAG) {
        const holder = state.players.find((p: Entity) => !p.dead && p.hasFlag === p.team && p.team !== Team.NONE);
        if (holder && now - (state.lastHTFScore || 0) >= HTF_SCORE_INTERVAL) {
            state.scores[holder.team] += 1;
            state.lastHTFScore = now;
            state.floatingTexts.push({
                id: Math.random().toString(),
                pos: { ...holder.pos, y: holder.pos.y - 20 },
                text: '+1',
                color: '#22c55e',
                life: 1,
                velY: 1
            });
            playSound('score', undefined, isMuted);
            if (state.scores[holder.team] >= HTF_WIN_SCORE) {
                // TODO: surface victory screen/state; for now just clamp
                state.scores[holder.team] = HTF_WIN_SCORE;
            }
        }
    }

    if (state.mode === GameMode.INFILTRATION) {
        if (!state.infiltrationEndTime) state.infiltrationEndTime = now + INFILTRATION_TIMER;
        const intel = state.pickups.find((p: Pickup) => p.type === ItemType.INTEL);
        const carrier = state.players.find((p: Entity) => !p.dead && p.hasFlag === Team.RED);
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
                    id: Math.random().toString(),
                    pos: { ...carrier.pos, y: carrier.pos.y - 40 },
                    text: 'EXTRACTED',
                    color: '#facc15',
                    life: 1,
                    velY: 1
                });
                state.infiltrationEndTime = now + INFILTRATION_TIMER;
                state.pickups = state.pickups.filter((p: Pickup) => p.type !== ItemType.INTEL);
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
        }

        if (state.infiltrationEndTime && now > state.infiltrationEndTime) {
            state.scores[Team.RED] += 1;
            state.infiltrationEndTime = now + INFILTRATION_TIMER;
            state.players.forEach((p: Entity) => { if (p.hasFlag === Team.RED) p.hasFlag = Team.NONE; });
            state.pickups = state.pickups.filter((p: Pickup) => p.type !== ItemType.INTEL);
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
    }

    // Particles
    state.particles.forEach((p: Particle) => {
        p.pos.x += p.vel.x; p.pos.y += p.vel.y;
        if (p.type === 'shell') {
            p.vel.y += GRAVITY; p.rotation = (p.rotation || 0) + p.vel.x * 0.1;
            state.platforms.forEach((plat: Platform) => {
                if (p.pos.y > plat.y && p.pos.y < plat.y + plat.h && p.pos.x > plat.x && p.pos.x < plat.x + plat.w) {
                    if (Math.abs(p.vel.y) > 1) { p.vel.y *= -0.5; p.pos.y = plat.y; } else { p.vel.y = 0; p.vel.x *= 0.8; }
                }
            });
        } else {
            if (p.type !== 'fire') p.vel.y += GRAVITY * 0.1; p.vel.x *= 0.9; p.vel.y *= 0.9;
        }
        p.life -= p.decay;
    });
    state.particles = state.particles.filter((p: Particle) => p.life > 0);

    // Floating Text
    state.floatingTexts.forEach((t: FloatingText) => { t.pos.y -= t.velY; t.life -= 0.02; });
    state.floatingTexts = state.floatingTexts.filter((t: FloatingText) => t.life > 0);

    // Remove corpses older than 10 seconds
    const corpseLifetime = 10000; // 10 seconds
    state.decals = state.decals.filter((d: Decal) => {
        if ((d as any).isCorpse && d.createdAt) {
            return (now - d.createdAt) < corpseLifetime;
        }
        return true;
    });
    // Limit total decals to prevent memory issues
    if (state.decals.length > 50) state.decals.shift();

    // Ragdoll Physics
    state.ragdollParts.forEach((part: RagdollPart) => {
        // Apply gravity
        part.vel.y += GRAVITY;

        // Apply velocity
        part.pos.x += part.vel.x;
        part.pos.y += part.vel.y;

        // Apply rotation
        part.rotation += part.angularVel;

        // Ground collision
        part.isGrounded = false;
        state.platforms.forEach((plat: Platform) => {
            if (part.pos.y > plat.y && part.pos.y < plat.y + plat.h &&
                part.pos.x > plat.x && part.pos.x < plat.x + plat.w) {
                if (part.vel.y > 0) {
                    part.pos.y = plat.y;
                    part.vel.y *= -0.3; // Bounce
                    part.vel.x *= 0.8; // Friction
                    part.angularVel *= 0.7; // Slow rotation
                    part.isGrounded = true;

                    // Stop if moving too slow
                    if (Math.abs(part.vel.y) < 0.5) part.vel.y = 0;
                    if (Math.abs(part.vel.x) < 0.1) part.vel.x = 0;
                    if (Math.abs(part.angularVel) < 0.02) part.angularVel = 0;
                }
            }
        });

        // Air resistance
        if (!part.isGrounded) {
            part.vel.x *= 0.98;
            part.angularVel *= 0.98;
        }

        // Fade out
        part.life -= 0.02;
    });

    // Remove dead ragdoll parts
    state.ragdollParts = state.ragdollParts.filter((p: RagdollPart) => p.life > 0);

    // Camera
    const player = state.players[0];
    if (player) {
        const targetX = player.pos.x;
        const targetY = player.pos.y - 50;
        state.camera.x += (targetX - state.camera.x) * 0.1;
        state.camera.y += (targetY - state.camera.y) * 0.1;
    }
};
