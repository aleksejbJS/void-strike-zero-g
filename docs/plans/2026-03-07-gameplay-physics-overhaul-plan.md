# Gameplay Physics Overhaul — Implementation Plan

**Goal:** Replace flat movement mechanics with deep Soldat-style physics featuring directional jetpack, pendulum grapple, rocket-jumping, and air control.
**Design doc:** `docs/plans/2026-03-07-gameplay-physics-overhaul-design.md`
**Architecture:** New `movement.ts` manages all forces in a pipeline; new `grapple.ts` handles pendulum swing. Matter.js handles only collision resolution (gravity=0). Combat gets self-damage multipliers and per-weapon knockback.
**Tech Stack:** TypeScript, Matter.js (collision only), Vitest (tests)

---

## Task 1: Add `knockbackForce` to Weapon interface and update WEAPONS_DATA

**Estimated time:** 3 minutes
**Files:**
- Modify: `src/types.ts` (line ~51)
- Modify: `src/constants.ts` (lines ~66-144)

**Step 1: Add `knockbackForce` field to the `Weapon` interface**

In `src/types.ts`, add `knockbackForce` after the `recoil` field:

```typescript
export interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  speed: number;
  color: string;
  ammo: number;
  maxAmmo: number;
  recoil: number;
  knockbackForce: number; // force applied to target on hit
}
```

**Step 2: Add `knockbackForce` to every weapon in WEAPONS_DATA**

In `src/constants.ts`, add the `knockbackForce` field to each weapon entry:

```typescript
[WeaponType.MACHINE_GUN]: {
    type: WeaponType.MACHINE_GUN,
    name: 'Machine Gun',
    damage: 6,
    fireRate: 100,
    speed: 18,
    color: '#fbbf24',
    ammo: 999,
    maxAmmo: 999,
    recoil: 0.2,
    knockbackForce: 0.3,
},
[WeaponType.SHOTGUN]: {
    type: WeaponType.SHOTGUN,
    name: 'Shotgun',
    damage: 5,
    fireRate: 900,
    speed: 20,
    color: '#9ca3af',
    ammo: 20,
    maxAmmo: 50,
    recoil: 4,
    knockbackForce: 1.5,
},
[WeaponType.PLASMA_GUN]: {
    type: WeaponType.PLASMA_GUN,
    name: 'Plasma Gun',
    damage: 14,
    fireRate: 120,
    speed: 14,
    color: '#3b82f6',
    ammo: 50,
    maxAmmo: 150,
    recoil: 0.5,
    knockbackForce: 0.5,
},
[WeaponType.ROCKET_LAUNCHER]: {
    type: WeaponType.ROCKET_LAUNCHER,
    name: 'Rocket Launcher',
    damage: 65,
    fireRate: 1000,
    speed: 12,
    color: '#f97316',
    ammo: 10,
    maxAmmo: 30,
    recoil: 3,
    knockbackForce: 4.0,
},
[WeaponType.GRENADE_LAUNCHER]: {
    type: WeaponType.GRENADE_LAUNCHER,
    name: 'Grenade Launcher',
    damage: 60,
    fireRate: 800,
    speed: 14,
    color: '#ef4444',
    ammo: 15,
    maxAmmo: 40,
    recoil: 3,
    knockbackForce: 3.5,
},
[WeaponType.RAILGUN]: {
    type: WeaponType.RAILGUN,
    name: 'Railgun',
    damage: 200,
    fireRate: 1500,
    speed: 100,
    color: '#38bdf8',
    ammo: 5,
    maxAmmo: 15,
    recoil: 7,
    knockbackForce: 6.0,
},
[WeaponType.CHAINSAW]: {
    type: WeaponType.CHAINSAW,
    name: 'Chainsaw',
    damage: 30,
    fireRate: 140,
    speed: 0,
    color: '#ef4444',
    ammo: 120,
    maxAmmo: 200,
    recoil: 0.2,
    knockbackForce: 0.2,
},
```

**Step 3: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | head -40`
Expected: All existing tests still pass (the new field is additive).

**Step 4: Commit**
```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add knockbackForce field to Weapon interface and data"
```

---

## Task 2: Update constants.ts with new physics constants

**Estimated time:** 3 minutes
**Files:**
- Modify: `src/constants.ts` (lines ~3-30)

**Step 1: Replace old physics constants and add new ones**

Replace the physics constants block (lines 3-13) and jetpack block (lines 22-25) and hook block (lines 28-30) with the expanded set:

```typescript
// Physics - "Soldat" feel (Heavy but fast)
export const GRAVITY = 0.36;
export const GROUND_FRICTION = 0.85;    // was FRICTION = 0.9
export const AIR_RESISTANCE = 0.995;    // was 0.99 — longer arcs
export const MOVE_SPEED = 0.22;
export const CROUCH_SPEED = 0.13;
export const JUMP_FORCE = -14;
export const DOUBLE_JUMP_FORCE = -10;
export const SOFT_SPEED_CAP = 3.2;      // was MAX_SPEED
export const HARD_SPEED_CAP = 8.0;      // ceiling for rocket-jump
export const SPEED_DECAY_ABOVE_CAP = 0.98;
export const AIR_STRAFE_FORCE = 0.08;   // weak air control without jetpack
export const DASH_COOLDOWN = 1100;
export const DASH_FORCE = 10;

// Jetpack / Flying — directional thrust
export const JETPACK_FORCE_UP = -0.6;       // primary vertical thrust
export const JETPACK_FORCE_SIDE = 0.35;     // horizontal correction
export const JETPACK_FORCE_DOWN = 0.3;      // fast descent
export const JETPACK_BOOST_MULT = 1.4;      // W+Space boost multiplier
export const JETPACK_FUEL_MAX = 100;
export const JETPACK_CONSUMPTION = 1.1;
export const JETPACK_RECHARGE = 0.95;
export const JETPACK_SIDE_FUEL_MULT = 0.6;  // side thrust consumes less fuel

// Grapple — pendulum swing
export const HOOK_SPEED = 25;
export const HOOK_RANGE = 600;
export const HOOK_REEL_SPEED = 2.0;       // reel-in speed (W while hooked)
export const HOOK_EXTEND_SPEED = 1.5;     // extend speed (S while hooked)
export const HOOK_RELEASE_BOOST = 1.15;   // velocity bonus on release
export const HOOK_MIN_LENGTH = 40;        // minimum rope length

// Combat physics
export const SELF_DAMAGE_MULT = 0.5;      // 50% self-damage from own explosions
export const SELF_KNOCKBACK_MULT = 2.0;   // 200% self-knockback (rocket-jump)
export const KNOCKBACK_AIR_MULT = 1.5;    // knockback is stronger in air
```

Also add these aliases so existing imports don't break:

```typescript
// Legacy aliases (used by bot.ts and MatterEngine — keep until those are updated)
export const FRICTION = GROUND_FRICTION;
export const MAX_SPEED = SOFT_SPEED_CAP;
export const JETPACK_FORCE = JETPACK_FORCE_UP;
export const HOOK_PULL_FORCE = 0.03; // kept for reference, no longer used in movement
```

**Step 2: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | head -40`
Expected: All tests pass. Aliases maintain backward compatibility.

**Step 3: Commit**
```bash
git add src/constants.ts
git commit -m "feat: add directional jetpack, pendulum grapple, and combat physics constants"
```

---

## Task 3: Add `dot` utility to math.ts

**Estimated time:** 2 minutes
**Files:**
- Modify: `src/game/utils/math.ts` (add after line 8)

**Step 1: Add the `dot` function**

After the `normalize` function (line 8), add:

```typescript
export const dot = (a: Vector2, b: Vector2) => a.x * b.x + a.y * b.y;
```

**Step 2: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | head -20`
Expected: All tests pass.

**Step 3: Commit**
```bash
git add src/game/utils/math.ts
git commit -m "feat: add dot product utility to math.ts"
```

---

## Task 4: Create `grapple.ts` — pendulum swing system

**Estimated time:** 8 minutes
**Files:**
- Create: `src/game/systems/grapple.ts`
- Create: `src/game/systems/grapple.test.ts`

**Step 1: Write the test file**

Create `src/game/systems/grapple.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyGrapplePhysics } from './grapple';
import { Entity, Team, WeaponType } from '../../types';

const makePlayer = (overrides: Partial<Entity> = {}): Entity => ({
    id: 'p1', type: 'player', team: Team.NONE,
    pos: { x: 100, y: 300 }, vel: { x: 0, y: 0 },
    width: 30, height: 72, color: '#fff',
    health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
    jetpackFuel: 100, maxFuel: 100, jetpackColor: '#fff',
    dead: false, respawnTimer: 0, facingRight: true,
    weapon: { type: WeaponType.MACHINE_GUN, name: 'MG', damage: 6, fireRate: 100, speed: 18, color: '#fff', ammo: 99, maxAmmo: 99, recoil: 0, knockbackForce: 0.3 },
    inventory: [], lastFired: 0, skinId: 'classic', name: 'Test',
    score: 0, isCrouching: false, isGrounded: false,
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE, lastDash: 0, lastProcessedInput: 0,
    ...overrides,
});

describe('grapple pendulum physics', () => {
    it('should constrain player to rope length when overshooting', () => {
        const p = makePlayer({
            pos: { x: 200, y: 300 },
            vel: { x: 5, y: 0 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 100 },
        });

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: false });

        // Player should be pulled back toward hook point
        const dist = Math.sqrt((p.pos.x - 100) ** 2 + (p.pos.y - 100) ** 2);
        expect(dist).toBeLessThanOrEqual(101); // within tolerance
    });

    it('should allow free movement when inside rope length', () => {
        const p = makePlayer({
            pos: { x: 120, y: 120 },
            vel: { x: 2, y: 1 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 300 },
        });
        const origVelX = p.vel.x;
        const origVelY = p.vel.y;

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: false });

        // Velocity unchanged — rope is slack
        expect(p.vel.x).toBe(origVelX);
        expect(p.vel.y).toBe(origVelY);
    });

    it('should shorten rope when reeling in', () => {
        const p = makePlayer({
            pos: { x: 200, y: 200 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 200 },
        });

        applyGrapplePhysics(p, { wantsReel: true, wantsExtend: false });

        expect(p.grapple.length).toBeLessThan(200);
    });

    it('should extend rope when extending', () => {
        const p = makePlayer({
            pos: { x: 150, y: 150 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 100 },
        });

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: true });

        expect(p.grapple.length).toBeGreaterThan(100);
    });

    it('should not shorten below HOOK_MIN_LENGTH', () => {
        const p = makePlayer({
            pos: { x: 110, y: 110 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 42 },
        });

        applyGrapplePhysics(p, { wantsReel: true, wantsExtend: false });

        expect(p.grapple.length).toBeGreaterThanOrEqual(40);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/game/systems/grapple.test.ts 2>&1 | tail -10`
Expected: FAIL (module not found)

**Step 3: Create the implementation**

Create `src/game/systems/grapple.ts`:

```typescript
// Pendulum grapple physics — rope constraint with swing mechanics
// Replaces the old constant-pull grapple from physics.ts

import { Entity, Vector2 } from '../../types';
import { distance, normalize, dot } from '../utils/math';
import {
    HOOK_REEL_SPEED,
    HOOK_EXTEND_SPEED,
    HOOK_RELEASE_BOOST,
    HOOK_MIN_LENGTH,
    HOOK_RANGE,
} from '../../constants';

export interface GrappleInput {
    wantsReel: boolean;    // W key while hooked
    wantsExtend: boolean;  // S key while hooked
}

/**
 * Apply pendulum grapple constraint to a player.
 * Call AFTER gravity and inputs are applied, BEFORE friction/speed limits.
 * Modifies player.pos, player.vel, and player.grapple.length in place.
 */
export const applyGrapplePhysics = (p: Entity, input: GrappleInput): void => {
    if (!p.grapple.active) return;

    const hookPos = p.grapple.pos;

    // Reel in / extend rope
    if (input.wantsReel) {
        p.grapple.length = Math.max(HOOK_MIN_LENGTH, p.grapple.length - HOOK_REEL_SPEED);
    }
    if (input.wantsExtend) {
        p.grapple.length = Math.min(HOOK_RANGE, p.grapple.length + HOOK_EXTEND_SPEED);
    }

    // Rope constraint: if player is beyond rope length, pull them back
    const dist = distance(p.pos, hookPos);
    if (dist <= p.grapple.length) return; // Slack — no constraint needed

    // Direction from player toward hook point
    const dir = normalize({ x: hookPos.x - p.pos.x, y: hookPos.y - p.pos.y });

    // Snap position to rope length
    const overshoot = dist - p.grapple.length;
    p.pos.x += dir.x * overshoot;
    p.pos.y += dir.y * overshoot;

    // Remove the radial (outward) component of velocity, keep tangential
    const radialVel = dot(p.vel, dir);
    if (radialVel < 0) {
        // Moving away from hook — remove that component
        p.vel.x -= dir.x * radialVel;
        p.vel.y -= dir.y * radialVel;
    }
};

/**
 * Apply velocity boost when releasing the grapple.
 * Call once at the moment the player releases the hook button.
 */
export const applyGrappleRelease = (p: Entity): void => {
    const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    if (speed > 0.5) {
        // Boost in current movement direction
        const dir = normalize(p.vel);
        p.vel.x = dir.x * speed * HOOK_RELEASE_BOOST;
        p.vel.y = dir.y * speed * HOOK_RELEASE_BOOST;
    }
};
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/game/systems/grapple.test.ts 2>&1 | tail -10`
Expected: PASS (all 5 tests)

**Step 5: Commit**
```bash
git add src/game/systems/grapple.ts src/game/systems/grapple.test.ts
git commit -m "feat: add pendulum grapple physics with rope constraint and swing"
```

---

## Task 5: Create `movement.ts` — the Force Pipeline

**Estimated time:** 10 minutes
**Files:**
- Create: `src/game/systems/movement.ts`
- Create: `src/game/systems/movement.test.ts`

**Step 1: Write the test file**

Create `src/game/systems/movement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyMovement, MovementInput } from './movement';
import { Entity, Team, WeaponType, GameState, GameMode } from '../../types';

const makePlayer = (overrides: Partial<Entity> = {}): Entity => ({
    id: 'p1', type: 'player', team: Team.NONE,
    pos: { x: 100, y: 300 }, vel: { x: 0, y: 0 },
    width: 30, height: 72, color: '#fff',
    health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
    jetpackFuel: 100, maxFuel: 100, jetpackColor: '#fff',
    dead: false, respawnTimer: 0, facingRight: true,
    weapon: { type: WeaponType.MACHINE_GUN, name: 'MG', damage: 6, fireRate: 100, speed: 18, color: '#fff', ammo: 99, maxAmmo: 99, recoil: 0, knockbackForce: 0.3 },
    inventory: [], lastFired: 0, skinId: 'classic', name: 'Test',
    score: 0, isCrouching: false, isGrounded: true,
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE, lastDash: 0, lastProcessedInput: 0,
    ...overrides,
});

const noInput: MovementInput = {
    inputX: 0,
    isFlying: false,
    wantsJump: false,
    wantsDown: false,
    wantsReel: false,
    wantsExtend: false,
};

describe('Force Pipeline — movement.ts', () => {
    it('should apply gravity when not grounded', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 0 } });
        applyMovement(p, noInput);
        expect(p.vel.y).toBeGreaterThan(0); // gravity pulls down
    });

    it('should NOT apply gravity when grounded', () => {
        const p = makePlayer({ isGrounded: true, vel: { x: 0, y: 0 } });
        applyMovement(p, noInput);
        expect(p.vel.y).toBe(0);
    });

    it('should accelerate horizontally on ground with input', () => {
        const p = makePlayer({ isGrounded: true });
        applyMovement(p, { ...noInput, inputX: 1 });
        expect(p.vel.x).toBeGreaterThan(0);
    });

    it('should apply air strafe (weaker) when airborne', () => {
        const p = makePlayer({ isGrounded: false });
        applyMovement(p, { ...noInput, inputX: 1 });
        // Air strafe should be weaker than ground move
        const airVelX = p.vel.x;

        const p2 = makePlayer({ isGrounded: true });
        applyMovement(p2, { ...noInput, inputX: 1 });
        expect(airVelX).toBeLessThan(p2.vel.x);
    });

    it('should apply upward jetpack thrust', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 2 } });
        applyMovement(p, { ...noInput, isFlying: true, wantsJump: true });
        expect(p.vel.y).toBeLessThan(2); // thrust fights gravity
        expect(p.jetpackFuel).toBeLessThan(100); // consumed fuel
    });

    it('should apply diagonal jetpack thrust with side input', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 0 } });
        applyMovement(p, { ...noInput, isFlying: true, wantsJump: true, inputX: 1 });
        expect(p.vel.x).toBeGreaterThan(0); // side thrust
        expect(p.vel.y).toBeLessThan(0);    // up thrust
    });

    it('should recharge fuel only on ground', () => {
        const p = makePlayer({ isGrounded: true, jetpackFuel: 50 });
        applyMovement(p, noInput);
        expect(p.jetpackFuel).toBeGreaterThan(50);

        const p2 = makePlayer({ isGrounded: false, jetpackFuel: 50 });
        applyMovement(p2, noInput);
        expect(p2.jetpackFuel).toBe(50); // no recharge in air
    });

    it('should apply ground friction', () => {
        const p = makePlayer({ isGrounded: true, vel: { x: 5, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThan(5);
    });

    it('should soft-cap speed above SOFT_SPEED_CAP', () => {
        const p = makePlayer({ vel: { x: 6, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThan(6); // decayed
    });

    it('should hard-cap speed at HARD_SPEED_CAP', () => {
        const p = makePlayer({ vel: { x: 20, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThanOrEqual(8.0);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/game/systems/movement.test.ts 2>&1 | tail -10`
Expected: FAIL (module not found)

**Step 3: Create the implementation**

Create `src/game/systems/movement.ts`:

```typescript
// Force Pipeline — unified movement system (Soldat-Core)
// Manages all forces per player per tick in strict order:
// 1. Gravity  2. Inputs  3. Jetpack  4. Grapple  5. Friction  6. Speed limits

import { Entity } from '../../types';
import {
    GRAVITY,
    MOVE_SPEED,
    CROUCH_SPEED,
    GROUND_FRICTION,
    AIR_RESISTANCE,
    AIR_STRAFE_FORCE,
    SOFT_SPEED_CAP,
    HARD_SPEED_CAP,
    SPEED_DECAY_ABOVE_CAP,
    JETPACK_FORCE_UP,
    JETPACK_FORCE_SIDE,
    JETPACK_FORCE_DOWN,
    JETPACK_BOOST_MULT,
    JETPACK_CONSUMPTION,
    JETPACK_RECHARGE,
    JETPACK_SIDE_FUEL_MULT,
} from '../../constants';
import { applyGrapplePhysics, GrappleInput } from './grapple';
import { createParticles } from './combat';
import { GameState } from '../../types';

export interface MovementInput {
    inputX: number;       // -1, 0, or 1
    isFlying: boolean;    // wants to use jetpack
    wantsJump: boolean;   // W or Space held
    wantsDown: boolean;   // S held
    wantsReel: boolean;   // W held while grapple active
    wantsExtend: boolean; // S held while grapple active
}

/**
 * Apply all movement forces to a single entity.
 * Call once per tick per player/bot, BEFORE syncing to Matter.js.
 * Optionally pass GameState to emit jetpack particles.
 */
export const applyMovement = (p: Entity, input: MovementInput, state?: GameState): void => {
    // --- 1. Gravity ---
    if (!p.isGrounded) {
        p.vel.y += GRAVITY;
    }

    // --- 2. Player/Bot horizontal input ---
    if (p.isGrounded) {
        const speed = p.isCrouching ? CROUCH_SPEED : MOVE_SPEED;
        p.vel.x += input.inputX * speed;
    } else if (!input.isFlying) {
        // Air strafe — weak control without jetpack
        p.vel.x += input.inputX * AIR_STRAFE_FORCE;
    }

    // --- 3. Jetpack — directional thrust ---
    if (input.isFlying && p.jetpackFuel > 0) {
        let thrustX = 0;
        let thrustY = JETPACK_FORCE_UP;
        let fuelMult = 1.0;

        // Directional modifiers
        if (input.inputX !== 0) {
            // Diagonal thrust: up + side
            thrustX = input.inputX * JETPACK_FORCE_SIDE;
            fuelMult = JETPACK_SIDE_FUEL_MULT;
        }
        if (input.wantsDown) {
            // Fast descent
            thrustY = JETPACK_FORCE_DOWN;
        } else if (input.wantsJump && input.inputX === 0) {
            // Pure vertical boost (W + Space, no A/D)
            thrustY = JETPACK_FORCE_UP * JETPACK_BOOST_MULT;
        }

        p.vel.x += thrustX;
        p.vel.y += thrustY;
        p.jetpackFuel = Math.max(0, p.jetpackFuel - JETPACK_CONSUMPTION * fuelMult);

        // Visual: jetpack particles opposite to thrust direction
        if (state && Math.random() < 0.5) {
            const particleX = p.pos.x - thrustX * 30;
            const particleY = p.pos.y + 18;
            const intensity = fuelMult < 1 ? 1 : 2;
            createParticles(state, particleX, particleY, intensity, '#fbbf24', 'fire');
        }
    }

    // Fuel recharge — ONLY on ground (Soldat-style)
    if (p.isGrounded && !input.isFlying) {
        p.jetpackFuel = Math.min(p.maxFuel, p.jetpackFuel + JETPACK_RECHARGE);
    }

    // --- 4. Grapple (pendulum constraint) ---
    if (p.grapple.active) {
        const grappleInput: GrappleInput = {
            wantsReel: input.wantsReel,
            wantsExtend: input.wantsExtend,
        };
        applyGrapplePhysics(p, grappleInput);
    }

    // --- 5. Friction ---
    if (p.isGrounded) {
        p.vel.x *= GROUND_FRICTION;
    } else {
        p.vel.x *= AIR_RESISTANCE;
    }

    // --- 6. Speed limits (soft cap + hard cap) ---
    const speed = Math.abs(p.vel.x);
    if (speed > SOFT_SPEED_CAP) {
        p.vel.x *= SPEED_DECAY_ABOVE_CAP;
    }
    p.vel.x = Math.max(-HARD_SPEED_CAP, Math.min(HARD_SPEED_CAP, p.vel.x));

    // Vertical limits
    p.vel.y = Math.max(-HARD_SPEED_CAP, Math.min(HARD_SPEED_CAP, p.vel.y));
};
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/game/systems/movement.test.ts 2>&1 | tail -20`
Expected: PASS (all 10 tests)

**Step 5: Commit**
```bash
git add src/game/systems/movement.ts src/game/systems/movement.test.ts
git commit -m "feat: add Force Pipeline movement system with jetpack, air strafe, and speed caps"
```

---

## Task 6: Disable Matter.js gravity

**Estimated time:** 2 minutes
**Files:**
- Modify: `src/game/physics/MatterEngine.ts` (line 21)

**Step 1: Set Matter.js gravity to zero**

In `src/game/physics/MatterEngine.ts`, change line 21 from:

```typescript
        this.world.gravity.y = 1;
```

to:

```typescript
        // Gravity managed by movement.ts Force Pipeline — Matter.js handles collision only
        this.world.gravity.y = 0;
```

**Step 2: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | head -40`
Expected: All tests pass.

**Step 3: Commit**
```bash
git add src/game/physics/MatterEngine.ts
git commit -m "fix: disable Matter.js gravity — now managed by Force Pipeline"
```

---

## Task 7: Update combat.ts — rocket-jump and directional knockback

**Estimated time:** 8 minutes
**Files:**
- Modify: `src/game/systems/combat.ts` (lines 124-137 and 249-261)

**Step 1: Update `applyDamage` to use per-weapon knockback and air multiplier**

Replace the knockback calculation in `applyDamage` (lines 135-137) with:

```typescript
    // Directional knockback using per-weapon knockbackForce
    const len = Math.sqrt(knockback.x * knockback.x + knockback.y * knockback.y) || 1;
    const kbDir = { x: knockback.x / len, y: knockback.y / len };
    const airMult = target.isGrounded ? 1.0 : KNOCKBACK_AIR_MULT;
    const weaponKb = knockbackForce * airMult;
    target.vel.x += kbDir.x * weaponKb;
    target.vel.y += kbDir.y * weaponKb;
```

This requires updating the function signature to accept `knockbackForce`:

Replace the entire `applyDamage` signature (line 124) with:

```typescript
export const applyDamage = (state: GameState, target: Entity, attackerId: string, amount: number, knockback: Vector2, knockbackForce?: number) => {
```

And update the knockback block (replace lines 135-137) with:

```typescript
    const kbForce = knockbackForce ?? (amount / 10);
    const len = Math.sqrt(knockback.x * knockback.x + knockback.y * knockback.y) || 1;
    const kbDir = { x: knockback.x / len, y: knockback.y / len };
    const airMult = target.isGrounded ? 1.0 : KNOCKBACK_AIR_MULT;
    target.vel.x += kbDir.x * kbForce * airMult;
    target.vel.y += kbDir.y * kbForce * airMult;
```

Add the import for `KNOCKBACK_AIR_MULT` at line 5:

```typescript
import { GRAVITY, WEAPONS_DATA, RESPAWN_DELAY, SELF_DAMAGE_MULT, SELF_KNOCKBACK_MULT, KNOCKBACK_AIR_MULT } from '../../constants';
```

**Step 2: Update `createExplosion` for self-damage and self-knockback**

Replace `createExplosion` (lines 249-261) with:

```typescript
export const createExplosion = (state: GameState, pos: Vector2, ownerId: string, radius: number) => {
    createParticles(state, pos.x, pos.y, 20, '#f97316', 'fire');
    createParticles(state, pos.x, pos.y, 10, '#ffffff', 'smoke');
    gameEvents.emit({ type: 'SOUND', sound: 'explosion' });

    state.players.forEach(p => {
        const dist = distance(pos, p.pos);
        if (dist < radius) {
            const baseDmg = 100 * (1 - dist / radius);
            const isSelf = p.id === ownerId;
            const dmg = isSelf ? baseDmg * SELF_DAMAGE_MULT : baseDmg;
            const kbMult = isSelf ? SELF_KNOCKBACK_MULT : 1.0;
            // Radial knockback from explosion center
            const radialDir = { x: p.pos.x - pos.x, y: p.pos.y - pos.y };
            const kbForce = (baseDmg / 10) * kbMult;
            applyDamage(state, p, ownerId, dmg, radialDir, kbForce);
        }
    });
};
```

**Step 3: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | head -40`
Expected: All tests pass. The optional `knockbackForce` parameter keeps all existing call sites working.

**Step 4: Commit**
```bash
git add src/game/systems/combat.ts
git commit -m "feat: add rocket-jump self-knockback, directional knockback, and air multiplier"
```

---

## Task 8: Wire movement.ts into physics.ts

**Estimated time:** 10 minutes
**Files:**
- Modify: `src/game/systems/physics.ts` (lines 1-12, 112-293)

**Step 1: Update imports**

Replace the imports at the top of `src/game/systems/physics.ts` (lines 1-12) with:

```typescript
import { GameState, Entity, Platform, Vector2, WeaponType, ItemType, GameMode, Team, PlayerInput, RagdollPart } from '../../types';
import { GRAVITY, GROUND_FRICTION, AIR_RESISTANCE, MOVE_SPEED, CROUCH_SPEED, JUMP_FORCE, JETPACK_FORCE_UP, JETPACK_CONSUMPTION, JETPACK_RECHARGE, SOFT_SPEED_CAP, HARD_SPEED_CAP, DASH_COOLDOWN, DASH_FORCE, HOOK_RANGE, WEAPONS_DATA, ITEMS_DATA, RESPAWN_DELAY, ITEM_RESPAWN_TIME, HTF_SCORE_INTERVAL, HTF_WIN_SCORE, INFILTRATION_TIMER, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../../constants';
import { gameEvents } from './events';
import { nextId } from '../utils/id';
import { updateBotAI } from './bot';
import { distance, normalize, checkPointInRect, checkRectOverlap, segmentIntersectsRect } from '../utils/math';
import { baseFlagPos, HTF_FLAG_POS, EXTRACTION_ZONE, INTEL_POS } from '../data/level';
import { trackKill, trackFlagCapture, trackFlagHoldTime, trackDoubleJump, trackHookUse, trackDashUse, trackItemPickup } from './achievements';
import { resetFlagToBase, applyGunGameLoadout } from './gamemodes';
import { applyDamage, fireWeapon, createParticles, resolveCollision, castRay, createExplosion } from './combat';
import { updateParticles, updateFloatingTexts, updateDecals, updateRagdolls } from './particles';
import { applyMovement, MovementInput } from './movement';
import { applyGrappleRelease } from './grapple';
```

**Step 2: Replace the per-player physics block**

In the `state.players.forEach(p => {...})` block (starting line 113), replace the section from the input parsing through grapple/jetpack/friction (lines 112-293) with the new version. The key changes are:

1. Build a `MovementInput` from the parsed keys
2. Call `applyMovement(p, movementInput, state)` instead of inline jetpack/grapple/friction
3. Handle grapple activation/release with `applyGrappleRelease`

Replace the block from line 135 (`if (p.type === 'player') {`) through line 293 with:

```typescript
        if (p.type === 'player') {
            const wantsJump = !!(pKeys['Space'] || pKeys['KeyW']);
            p.isCrouching = !!pKeys['KeyS'];
            if (pKeys['KeyA']) inputX -= 1;
            if (pKeys['KeyD']) inputX += 1;
            if (wantsJump && p.jetpackFuel > 0) isFlying = true;

            let worldMouseX, worldMouseY;
            if (isLocal) {
                const cx = screenW / 2;
                const cy = screenH / 2;
                worldMouseX = (pMouse.x - cx) + state.camera.x;
                worldMouseY = (pMouse.y - cy) + state.camera.y;
            } else {
                worldMouseX = pMouse.x;
                worldMouseY = pMouse.y;
            }

            if (pMousePressed && now - p.lastFired > p.weapon.fireRate) {
                fireWeapon(state, p, { x: worldMouseX, y: worldMouseY });
            }

            // Grapple activation
            if (pHookPressed && !p.grapple.active) {
                const dir = normalize({ x: worldMouseX - p.pos.x, y: worldMouseY - p.pos.y });
                const hit = castRay(state, { x: p.pos.x, y: p.pos.y }, dir, HOOK_RANGE);
                if (hit) {
                    p.grapple.active = true;
                    p.grapple.pos = hit;
                    p.grapple.length = distance(p.pos, hit);
                    if (p.type === 'player') trackHookUse();
                }
            } else if (!pHookPressed && p.grapple.active) {
                // Release: apply momentum boost
                applyGrappleRelease(p);
                p.grapple.active = false;
            }

            // HTF flag throw
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

            p.height = p.isCrouching ? 45 : 72;
        } else {
            // BOT AI
            isFlying = updateBotAI(p, state, now, (bot, target) => fireWeapon(state, bot, target), state.mode);
        }

        // --- Force Pipeline (replaces inline jetpack/grapple/friction) ---
        const movementInput: MovementInput = {
            inputX,
            isFlying,
            wantsJump: isFlying, // for jetpack boost direction
            wantsDown: p.isCrouching && isFlying,
            wantsReel: p.grapple.active && !!(p.type === 'player' ? pKeys?.['KeyW'] : false),
            wantsExtend: p.grapple.active && !!(p.type === 'player' ? pKeys?.['KeyS'] : false),
        };
        applyMovement(p, movementInput, state);

        // HTF flag carrier slowdown
        if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team) {
            p.vel.x *= 0.85;
        }

        // Map ceiling
        if (p.pos.y < -500) {
            p.pos.y = -500;
            if (p.vel.y < 0) p.vel.y = 0;
        }

        // Map Bounds Death
        if (p.pos.y > 2500) applyDamage(state, p, '', 9999, { x: 0, y: 0 });

        // Hunger Games zone clamp
        if (state.mode === GameMode.HUNGER_GAMES && state.hungerZone) {
            const hz = state.hungerZone;
            const pad = 10;
            if (p.pos.x < hz.x + pad && p.vel.x < 0) p.vel.x = 0;
            if (p.pos.x > hz.x + hz.w - pad && p.vel.x > 0) p.vel.x = 0;
            if (p.pos.y < hz.y + pad && p.vel.y < 0) p.vel.y = 0;
            if (p.pos.y > hz.y + hz.h - pad && p.vel.y > 0) p.vel.y = 0;
        }
```

**Step 3: Verify**
Run: `npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass.

**Step 4: Commit**
```bash
git add src/game/systems/physics.ts
git commit -m "feat: wire Force Pipeline into physics loop, replacing inline jetpack/grapple/friction"
```

---

## Task 9: Run full test suite and verify

**Estimated time:** 3 minutes
**Files:** None (verification only)

**Step 1: Run all tests**
Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

**Step 2: Run lint check**
Run: `npx eslint src/game/systems/movement.ts src/game/systems/grapple.ts src/constants.ts src/types.ts`
Expected: No errors.

**Step 3: Run build**
Run: `npx vite build 2>&1 | tail -10`
Expected: Build succeeds.

**Step 4: Commit (if lint fixes were needed)**
```bash
git add -A
git commit -m "chore: fix lint issues from physics overhaul"
```

---

## Task 10: Update physics.test.ts for new movement behavior

**Estimated time:** 5 minutes
**Files:**
- Modify: `src/game/systems/physics.test.ts`

**Step 1: Update `createMockPlayer` to include `knockbackForce`**

In `physics.test.ts`, update the weapon mock inside `createMockPlayer` (line 42-51) to include the new field:

```typescript
    weapon: {
        type: WeaponType.MACHINE_GUN,
        name: 'Machine Gun',
        damage: 10,
        fireRate: 100,
        speed: 10,
        color: '#fff',
        ammo: 100,
        maxAmmo: 100,
        recoil: 0,
        knockbackForce: 0.3,
    },
```

**Step 2: Run tests to verify**
Run: `npx vitest run src/game/systems/physics.test.ts --reporter=verbose`
Expected: All existing Gun Game tests still pass.

**Step 3: Commit**
```bash
git add src/game/systems/physics.test.ts
git commit -m "test: update physics test mock to include knockbackForce field"
```

---

## Summary

| Task | What | Time Est. |
|------|------|-----------|
| 1 | Add `knockbackForce` to Weapon interface + WEAPONS_DATA | 3 min |
| 2 | Update constants.ts with new physics constants | 3 min |
| 3 | Add `dot` utility to math.ts | 2 min |
| 4 | Create `grapple.ts` — pendulum swing system + tests | 8 min |
| 5 | Create `movement.ts` — Force Pipeline + tests | 10 min |
| 6 | Disable Matter.js gravity | 2 min |
| 7 | Update combat.ts — rocket-jump and knockback | 8 min |
| 8 | Wire movement.ts into physics.ts | 10 min |
| 9 | Full test suite + lint + build verification | 3 min |
| 10 | Update physics.test.ts mock | 5 min |
| **Total** | | **~54 min** |

## Key Risks

1. **Bot movement:** Bots use `BOT_MOVE_SPEED` directly in `bot.ts` (line 264). The Force Pipeline's ground friction and air resistance will now also apply to them via `applyMovement`. This should make bots feel more natural, but their speed tuning might need adjustment.
2. **Matter.js interaction:** Setting gravity to 0 means ALL gravity comes from the Force Pipeline. If `applyMovement` is not called for an entity (e.g., dead player), they won't fall. This is correct behavior since dead players use ragdoll physics.
3. **Existing `FRICTION`/`MAX_SPEED` imports:** Legacy aliases ensure `bot.ts` and any other files importing old constants still compile.

## After Implementation

All constants are tunable. After implementing, the recommended workflow is:
1. Launch `npm run dev`
2. Play a few rounds with bots
3. Adjust constants in `src/constants.ts` to taste
4. Focus on: rocket-jump height, grapple swing speed, air strafe responsiveness
