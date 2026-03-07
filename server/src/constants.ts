import { Weapon, WeaponType, ItemType } from './types';

// Physics - "Soldat" feel (Heavy but fast)
export const GRAVITY = 0.36; // еще мягче падение
export const FRICTION = 0.9;
export const AIR_RESISTANCE = 0.99;
export const MOVE_SPEED = 0.22; // Faster gameplay
export const CROUCH_SPEED = 0.13;
export const JUMP_FORCE = -14;
export const DOUBLE_JUMP_FORCE = -10;
export const MAX_SPEED = 3.2;
export const DASHE_COOLDOWN = 1100;
export const DASH_FORCE = 10;

// Bots tuning
export const BOT_MOVE_SPEED = 0.28; // Match faster gameplay
export const BOT_AIM_DISTANCE = 900;
export const BOT_VERTICAL_TOLERANCE = 300;
export const BOT_FIRE_COOLDOWN_SCALE = 1.1;

// Jetpack / Flying
export const JETPACK_FORCE = -0.5;
export const JETPACK_FUEL_MAX = 100;
export const JETPACK_CONSUMPTION = 1.1;
export const JETPACK_RECHARGE = 0.95;

// Mechanics
export const HOOK_SPEED = 25;
export const HOOK_PULL_FORCE = 0.03;
export const HOOK_RANGE = 600;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const ITEM_RESPAWN_TIME = 10000;
export const WEAPON_RESPAWN_TIME = 15000;
export const RESPAWN_DELAY = 3000;
export const HTF_SCORE_INTERVAL = 4000; // 4s tick while holding
export const HTF_WIN_SCORE = 200;
export const INFILTRATION_TIMER = 180000; // 3 minutes

export const SKINS = [
  { id: 'classic', name: 'Marine', color: '#3b82f6' },
  { id: 'red', name: 'Red Baron', color: '#ef4444' },
  { id: 'toxic', name: 'Toxic', color: '#22c55e' },
  { id: 'gold', name: 'Golden God', color: '#eab308' },
  { id: 'noir', name: 'Noir', color: '#333333' },
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
};

export const ITEMS_DATA = {
  [ItemType.HEALTH]: { color: '#ef4444', value: 25, size: 12, symbol: '+' },
  [ItemType.ARMOR]: { color: '#3b82f6', value: 50, size: 12, symbol: '🛡' },
  [ItemType.AMMO]: { color: '#fbbf24', value: 30, size: 12, symbol: '⚡' },
  [ItemType.WEAPON]: { color: '#ffffff', value: 0, size: 16, symbol: 'W' },
  [ItemType.FLAG]: { color: '#ffffff', value: 0, size: 20, symbol: '⚑' },
  [ItemType.FUEL]: { color: '#3b82f6', value: 150, size: 14, symbol: '⛽' },
};
