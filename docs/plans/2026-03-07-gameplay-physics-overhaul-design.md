# Gameplay Physics Overhaul — Soldat-Core Design

**Date:** 2026-03-07
**Status:** Approved
**Approach:** B — Soldat-Core (unified movement system with deep mechanics)

## Problem Statement

All gameplay mechanics (jetpack, grapple, weapon recoil, knockback) feel flat and lack depth.
No skill ceiling — no difference between a novice and experienced player. Additionally,
gravity values conflict between `constants.ts` (0.36) and `MatterEngine.ts` (1.0).

## Goals

1. Deep, interconnected movement mechanics with high skill ceiling
2. Unified force pipeline — single source of truth for all physics forces
3. Resolve gravity conflict between constants and Matter.js
4. Soldat-style feel: heavy but fast, momentum-based, rewarding mastery

## Architecture: Force Pipeline

### New File: `src/game/systems/movement.ts` (~180 lines)

Manages all forces per player per tick in strict order:

```
1. Gravity (unified, from constants.ts only)
2. Player inputs -> horizontal acceleration
3. Jetpack -> directional thrust
4. Grapple -> pendulum / pull force
5. Combat forces -> recoil, knockback, rocket-jump
6. Friction (ground/air)
7. Speed limits (soft + hard cap)
8. -> Push to Matter.js for collision resolution
9. <- Sync back to GameState
```

**Key change:** `MatterEngine.gravity.y = 0`. All gravity managed from `constants.ts`.

### New File: `src/game/systems/grapple.ts` (~120 lines)

Pendulum grapple physics, extracted from physics.ts.

### Updated Files:
- `constants.ts` — new movement/combat constants
- `combat.ts` — rocket-jump, directional knockback
- `physics.ts` — delegates movement to `movement.ts`
- `MatterEngine.ts` — gravity set to 0

## Section 1: Jetpack — Directional Thrust

### 8-Directional Thrust
- Space + nothing -> up (primary mode)
- Space + A/D -> diagonal up-left/right (45 deg) — maneuver
- Space + S -> downward brake thrust (fast descent / stabilization)
- Space + W -> strong vertical boost

### Fuel Economy (Soldat-style)
- Consumption depends on direction: up = more fuel, horizontal trim = less
- Recharge ONLY on ground — incentivizes landing
- Fuel pickup (maxFuel: 150) remains as-is

### Visual Feedback
- Jetpack fire particles directed opposite to thrust vector
- More intense fire at full thrust vs trim

### Constants
```typescript
JETPACK_FORCE_UP = -0.6       // primary vertical thrust
JETPACK_FORCE_SIDE = 0.35     // horizontal correction
JETPACK_FORCE_DOWN = 0.3      // fast descent
JETPACK_BOOST_MULT = 1.4      // W+Space boost multiplier
JETPACK_SIDE_FUEL_MULT = 0.6  // side thrust consumes less fuel
```

## Section 2: Grapple — Pendulum with Momentum Preservation

### Phase 1: Hook (unchanged — raycast)
- Ray to surface, attaches
- Rope length = distance to hook point

### Phase 2: Swing (pendulum)
- Rope acts as CONSTRAINT, not spring
- If distance > rope length -> pull to length (constraint resolution)
- If distance < length -> free movement (rope slack)
- Gravity + horizontal input create swing (Worms / Spider-Man style)
- W key -> shorten rope (reel in)
- S key -> extend rope

### Phase 3: Release — Momentum Preservation
- On release, current velocity FULLY preserved
- Key skill element: release at right moment = fly far
- Small speed bonus in movement direction (1.15x)

### Rope Constraint Math
```typescript
// Each tick:
dist = distance(player, hookPoint)
if (dist > ropeLength) {
    dir = normalize(hookPoint - player.pos)
    overshoot = dist - ropeLength
    player.pos += dir * overshoot

    // Remove radial velocity component (only if moving away)
    radialVel = dot(player.vel, dir)
    if (radialVel < 0) {
        player.vel -= dir * radialVel  // keep tangential velocity
    }
}
```

### Constants
```typescript
HOOK_REEL_SPEED = 2.0        // reel-in speed (W)
HOOK_EXTEND_SPEED = 1.5      // extend speed (S)
HOOK_RELEASE_BOOST = 1.15    // velocity bonus on release
HOOK_MIN_LENGTH = 40         // minimum rope length
```

## Section 3: Combat Physics — Rocket-Jump & Directional Knockback

### Rocket-Jump / Grenade-Boost
Own rockets and grenades deal 50% self-damage but 200% self-knockback:
- Shoot rocket down -> vertical boost (rocket-jump)
- Shoot at nearby wall -> horizontal boost
- Drop grenade under feet -> catapult across map

```typescript
SELF_DAMAGE_MULT = 0.5       // 50% damage to self
SELF_KNOCKBACK_MULT = 2.0    // 200% knockback to self (rocket-jump)
```

### Directional Knockback with Mass
- Knockback depends on HIT DIRECTION, not projectile velocity
- Heavy weapons (rockets, railgun) -> strong pushback
- Light weapons (machine gun, plasma) -> frequent small pushes -> "shake"
- Knockback in air is STRONGER (no ground friction, can't resist)

```typescript
KNOCKBACK_AIR_MULT = 1.5     // air knockback x1.5
// New field in Weapon interface: knockbackForce
// Machine Gun: 0.3, Shotgun: 1.5, Rocket: 4.0, Railgun: 6.0, etc.
```

### Explosion Spread
Explosions (rockets, grenades) create RADIAL knockback from explosion center,
not along projectile flight vector. More natural physics.

### Recoil as Movement
Railgun and shotgun recoil actually MOVES the player back (like Soldat).
Shotgun aimed down = additional upward boost. Skill expression.

## Section 4: Movement and Air Control

### Ground Movement (Soldat-feel)
- Fast acceleration (0 -> max in ~5 ticks)
- Hard friction on stop (GROUND_FRICTION = 0.85)
- Crouch slows but shrinks hitbox

### Air Strafe
Without jetpack in air, player has WEAK directional control:
- Horizontal input gives AIR_STRAFE_FORCE = 0.08 (vs MOVE_SPEED = 0.22 on ground)
- If input matches current velocity direction -> momentum preserved (no slowdown)
- If input against velocity -> slow deceleration

Skill expression: experienced player releases grapple and steers mid-air.

### Momentum Preservation
Key principle: velocity does NOT reset sharply.
- Ground: `vel.x *= GROUND_FRICTION` (0.85) — firm stop
- Air: `vel.x *= AIR_RESISTANCE` (0.995, was 0.99) — long graceful arcs

### Speed Limits (soft cap)
- Soft limit: above SOFT_SPEED_CAP velocity gradually decays (*= 0.98), not cut
- Hard limit: HARD_SPEED_CAP = absolute ceiling for rocket-jump/grenade boosts

### Constants
```typescript
AIR_STRAFE_FORCE = 0.08
AIR_RESISTANCE = 0.995          // was 0.99
GROUND_FRICTION = 0.85          // was 0.9 (harder stop)
SOFT_SPEED_CAP = 3.2            // current MAX_SPEED
HARD_SPEED_CAP = 8.0            // ceiling for rocket-jump
SPEED_DECAY_ABOVE_CAP = 0.98    // decay above soft cap
```

## Weapon Knockback Values (new field: knockbackForce)

| Weapon            | knockbackForce | Notes                           |
|-------------------|----------------|---------------------------------|
| Machine Gun       | 0.3            | Frequent small pushes           |
| Shotgun           | 1.5            | Strong close-range pushback     |
| Plasma Gun        | 0.5            | Medium, sustained               |
| Rocket Launcher   | 4.0            | Massive, radial from explosion  |
| Grenade Launcher  | 3.5            | Massive, radial from explosion  |
| Railgun           | 6.0            | Sniper pushback, single hit     |
| Chainsaw          | 0.2            | Rapid micro-pushes              |

## Impact on Existing Systems

### Bot AI (`bot.ts`)
- Bots currently don't use grapple — no change needed
- Jetpack AI: bots already use `isFlying` — directional thrust will work with existing decision logic
- Knockback changes are passive — bots receive them automatically

### Network Sync
- No new state fields needed (all changes modify existing vel/pos)
- Force pipeline runs on host only — clients receive synced state
- `PlayerInput` unchanged — W/A/S/D + Space already transmitted

### Maps / Pickups
- No map changes needed
- Fuel pickup remains at value=150 (extends maxFuel)

## Testing Strategy

1. **Unit tests** for movement.ts: verify force stacking, speed limits, air vs ground friction
2. **Unit tests** for grapple.ts: rope constraint, momentum on release, reel in/out
3. **Manual playtesting**: rocket-jump height, grapple swing feel, air strafe responsiveness
4. **Balance iteration**: tune constants after playtesting

## Migration Path

1. Create `movement.ts` and `grapple.ts` with new logic
2. Update `constants.ts` with new values
3. Set `MatterEngine.gravity.y = 0`
4. Update `physics.ts` to call `applyMovement()` instead of inline force code
5. Update `combat.ts` for self-damage/knockback multipliers and knockbackForce
6. Add `knockbackForce` to Weapon interface and WEAPONS_DATA
7. Run tests, iterate on constants
