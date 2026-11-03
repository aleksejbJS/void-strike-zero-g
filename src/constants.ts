import { Weapon, WeaponType, ItemType } from './types';

// Physics - "Soldat" feel (Heavy but fast)
export const GRAVITY = 0.36;
export const GROUND_FRICTION = 0.85;       // harder stop on ground (was 0.9)
export const AIR_RESISTANCE = 0.995;       // longer arcs in air (was 0.99)
export const MOVE_SPEED = 0.70;            // with GROUND_FRICTION 0.85 → runs ~240 px/s
export const CROUCH_SPEED = 0.40;          // ~135 px/s
export const PRONE_SPEED = 0.18;           // crawling, ~60 px/s
export const WALK_INPUT = 0.5;             // a half-pushed touch stick walks (the Walk key): ~120 px/s
export const JUMP_FORCE = -14;
export const DOUBLE_JUMP_FORCE = -10;
export const SOFT_SPEED_CAP = 4.8;         // soft limit — gradual decay above
export const HARD_SPEED_CAP = 8.0;         // absolute ceiling for rocket-jump
export const SPEED_DECAY_ABOVE_CAP = 0.98; // decay per tick above soft cap
export const AIR_STRAFE_FORCE = 0.08;      // weak air control without jetpack
export const DASH_COOLDOWN = 1100;
export const DASH_FORCE = 10;

// Bots tuning
export const BOT_AIM_DISTANCE = 900;
export const BOT_VERTICAL_TOLERANCE = 300;
export const BOT_FIRE_COOLDOWN_SCALE = 1.1;

// Jetpack / Flying — directional thrust
export const JETPACK_FORCE_UP = -0.6;      // primary vertical thrust
export const JETPACK_FORCE_SIDE = 0.35;    // horizontal correction
export const JETPACK_FORCE_DOWN = 0.3;     // fast descent
export const JETPACK_BOOST_MULT = 1.4;     // W+Space boost multiplier
export const JETPACK_FUEL_MAX = 100;
export const JETPACK_CONSUMPTION = 1.1;
export const JETPACK_RECHARGE = 0.95;
export const JETPACK_SIDE_FUEL_MULT = 0.6; // side thrust consumes less fuel

// Grapple — pendulum swing
export const HOOK_SPEED = 25;
export const HOOK_RANGE = 600;
export const HOOK_REEL_SPEED = 2.0;        // reel-in speed (W while hooked)
export const HOOK_EXTEND_SPEED = 1.5;      // extend speed (S while hooked)
export const HOOK_RELEASE_BOOST = 1.15;    // velocity bonus on release
export const HOOK_MIN_LENGTH = 40;         // minimum rope length

// Combat physics
export const SELF_DAMAGE_MULT = 0.5;       // 50% self-damage from own explosions
export const SELF_KNOCKBACK_MULT = 2.0;    // 200% self-knockback (rocket-jump)
export const KNOCKBACK_AIR_MULT = 1.5;     // knockback is stronger in air

// Legacy aliases — keep for backward compatibility with bot.ts etc.
export const FRICTION = GROUND_FRICTION;
export const MAX_SPEED = SOFT_SPEED_CAP;
export const JETPACK_FORCE = JETPACK_FORCE_UP;
export const HOOK_PULL_FORCE = 0.03;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const GUN_GAME_KILLS_PER_LEVEL = 5;
export const GUN_GAME_LADDER: WeaponType[] = [
  WeaponType.MACHINE_GUN,
  WeaponType.SHOTGUN,
  WeaponType.GRENADE_LAUNCHER,
  WeaponType.ROCKET_LAUNCHER,
  WeaponType.PLASMA_GUN,
  WeaponType.RAILGUN,
];

export const ITEM_RESPAWN_TIME = 10000;
export const WEAPON_RESPAWN_TIME = 15000;
export const RESPAWN_DELAY = 3000;
export const HTF_SCORE_INTERVAL = 4000; // 4s tick while holding
export const INFILTRATION_TIMER = 180000; // 3 minutes
// Simulation rate. All per-tick values (speeds, forces, lifetimes) were tuned at 120 ticks/s
// on a 120 Hz display, so the fixed step keeps that feel on every monitor.
export const PHYSICS_TICK_RATE = 120;
export const PROJECTILE_MAX_LIFE = 3 * PHYSICS_TICK_RATE; // ticks (3s) before a stray projectile is removed
export const DEFAULT_MAX_FUEL = 100;      // jetpack tank size without the fuel pickup bonus
export const HUNGER_SHRINK_STEP = 250;    // zone shrink per edge, per pending death
export const HUNGER_SHRINK_DELAY = 5000;  // ms between first death and the shrink
export const HUNGER_MIN_ZONE = 1200;      // zone never shrinks below this size
export const HUNGER_QUIET_SHRINK = 30000; // with no deaths, the zone still shrinks this often

export const SKINS = [
  { id: 'classic', name: 'Marine', color: '#3b82f6', style: 'human', palette: { torso: '#3b82f6', head: '#f59e0b', arms: '#3b82f6', legs: '#475569', jetpack: '#ef4444' } },
  { id: 'red', name: 'Red Baron', color: '#ef4444', style: 'human', palette: { torso: '#ef4444', head: '#f97316', arms: '#ef4444', legs: '#334155', jetpack: '#f59e0b' } },
  { id: 'toxic', name: 'Toxic', color: '#22c55e', style: 'alien', accent: '#10b981', palette: { torso: '#22c55e', head: '#38bdf8', arms: '#22c55e', legs: '#0f172a', jetpack: '#a855f7' } },
  { id: 'gold', name: 'Golden God', color: '#eab308', style: 'human', palette: { torso: '#eab308', head: '#f59e0b', arms: '#f59e0b', legs: '#334155', jetpack: '#f97316' } },
  { id: 'noir', name: 'Noir', color: '#333333', style: 'human', palette: { torso: '#1f2937', head: '#1f2937', arms: '#1f2937', legs: '#111827', jetpack: '#94a3b8' } },
  { id: 'hamster', name: 'Hammy', color: '#f59e0b', accent: '#f97316', style: 'beast', palette: { torso: '#f59e0b', head: '#f97316', arms: '#f59e0b', legs: '#c2410c', jetpack: '#f97316' } },
  { id: 'cyborg', name: 'Cyborg-01', color: '#38bdf8', accent: '#8b5cf6', style: 'robot', palette: { torso: '#0ea5e9', head: '#38bdf8', arms: '#8b5cf6', legs: '#0f172a', jetpack: '#94a3b8' } },
  { id: 'sentinel', name: 'Sentinel Bot', color: '#f97316', accent: '#94a3b8', style: 'robot', palette: { torso: '#f97316', head: '#e11d48', arms: '#f97316', legs: '#1f2937', jetpack: '#94a3b8' } },
  { id: 'wolf', name: 'Cyber Wolf', color: '#9ca3af', accent: '#22c55e', style: 'beast', palette: { torso: '#6b7280', head: '#9ca3af', arms: '#6b7280', legs: '#334155', jetpack: '#22c55e' } },
  { id: 'raptor', name: 'Sky Raptor', color: '#8b5cf6', accent: '#38bdf8', style: 'beast', palette: { torso: '#8b5cf6', head: '#22c55e', arms: '#a855f7', legs: '#312e81', jetpack: '#38bdf8' } },
  { id: 'hopper', name: 'Junkyard Hopper', color: '#10b981', accent: '#fbbf24', style: 'alien', palette: { torso: '#10b981', head: '#14b8a6', arms: '#22c55e', legs: '#0f172a', jetpack: '#fbbf24' } },
];

export const WEAPONS_DATA: Record<WeaponType, Weapon> = {
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
    color: '#3b82f6', // Blue
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
    color: '#ef4444', // Red
    ammo: 15,
    maxAmmo: 40,
    recoil: 3,
    knockbackForce: 3.5,
  },
  [WeaponType.RAILGUN]: {
    type: WeaponType.RAILGUN,
    name: 'Railgun',
    damage: 200, // one-shot, even through full armor (armor absorbs ~66%)
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
    fireRate: 140, // fast ticks while holding fire
    speed: 0, // Melee; no projectile
    color: '#ef4444',
    ammo: 120,
    maxAmmo: 200,
    recoil: 0.2,
    knockbackForce: 0.2,
  },
};

export const ITEMS_DATA = {
  [ItemType.HEALTH]: { color: '#ef4444', value: 25, size: 12, symbol: '+' },
  [ItemType.ARMOR]: { color: '#3b82f6', value: 50, size: 12, symbol: '🛡' },
  [ItemType.AMMO]: { color: '#fbbf24', value: 30, size: 12, symbol: '⚡' },
  [ItemType.WEAPON]: { color: '#ffffff', value: 0, size: 16, symbol: 'W' },
  [ItemType.FLAG]: { color: '#ffffff', value: 0, size: 20, symbol: '⚑' },
  [ItemType.FUEL]: { color: '#3b82f6', value: 150, size: 14, symbol: '⛽' },
};
