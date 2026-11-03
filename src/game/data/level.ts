import { GameMode, ItemType, Platform, Pickup, Team, WeaponType, MapId } from '../../types';

const BLUE_FLAG_POS = { x: -350, y: 470 };
const RED_FLAG_POS = { x: 2350, y: 470 };
export const HTF_FLAG_POS = { x: 1000, y: 410 };
export const INTEL_POS = { x: 2800, y: 0 };
export const EXTRACTION_ZONE = { x: -1200, y: 0, w: 200, h: 200 };

export const baseFlagPos = (team: Team) => (team === Team.BLUE ? { ...BLUE_FLAG_POS } : { ...RED_FLAG_POS });

// CTF Map - Original balanced map for Capture The Flag
const getCTFPlatforms = (): Omit<Platform, 'id'>[] => [
  { x: -1500, y: 800, w: 5000, h: 200, color: '#334155' },
  { x: -1500, y: -1500, w: 200, h: 2500, color: '#1e293b' },
  { x: 3300, y: -1500, w: 200, h: 2500, color: '#1e293b' },
  { x: 800, y: 600, w: 400, h: 40, color: '#475569' },
  { x: 900, y: 400, w: 200, h: 20, color: '#475569' },
  { x: 800, y: -200, w: 400, h: 30, color: '#475569' },
  { x: 100, y: 300, w: 150, h: 30, color: '#475569' },
  { x: 200, y: -100, w: 200, h: 30, color: '#475569' },
  { x: -500, y: 500, w: 300, h: 30, color: '#3b82f6' },
  { x: 1750, y: 300, w: 150, h: 30, color: '#475569' },
  { x: 1600, y: -100, w: 200, h: 30, color: '#475569' },
  { x: 2200, y: 500, w: 300, h: 30, color: '#ef4444' },
];

// Deathmatch Map - Larger tactical map with multiple elevation levels
const getDeathmatchPlatforms = (): Omit<Platform, 'id'>[] => [
  // Ground floor - Main base
  { x: -2000, y: 900, w: 6000, h: 200, color: '#334155' },

  // Boundaries
  { x: -2000, y: -1500, w: 200, h: 2600, color: '#1e293b' },
  { x: 3800, y: -1500, w: 200, h: 2600, color: '#1e293b' },

  // Left side - Multi-level structure
  { x: -1200, y: 700, w: 400, h: 40, color: '#475569' }, // Low platform
  { x: -1400, y: 500, w: 350, h: 35, color: '#475569' }, // Mid-low
  { x: -1100, y: 300, w: 300, h: 30, color: '#475569' }, // Mid
  { x: -1300, y: 100, w: 250, h: 30, color: '#475569' }, // Mid-high
  { x: -1500, y: -100, w: 400, h: 35, color: '#475569' }, // High sniper perch

  // Left-center - Flanking route
  { x: -400, y: 650, w: 350, h: 35, color: '#475569' },
  { x: -600, y: 400, w: 300, h: 30, color: '#475569' },
  { x: -300, y: 150, w: 250, h: 30, color: '#475569' },

  // Center - Contested area (multiple levels)
  { x: 600, y: 700, w: 800, h: 40, color: '#64748b' }, // Lower center
  { x: 800, y: 500, w: 400, h: 35, color: '#64748b' }, // Mid center
  { x: 700, y: 250, w: 600, h: 35, color: '#64748b' }, // Upper center
  { x: 900, y: 0, w: 200, h: 30, color: '#64748b' }, // Top center (high-value position)
  { x: 600, y: -250, w: 400, h: 30, color: '#64748b' }, // Elevated sniper spot

  // Right-center - Flanking route
  { x: 2050, y: 650, w: 350, h: 35, color: '#475569' },
  { x: 2300, y: 400, w: 300, h: 30, color: '#475569' },
  { x: 2150, y: 150, w: 250, h: 30, color: '#475569' },

  // Right side - Multi-level structure
  { x: 2800, y: 700, w: 400, h: 40, color: '#475569' }, // Low platform
  { x: 3050, y: 500, w: 350, h: 35, color: '#475569' }, // Mid-low
  { x: 2700, y: 300, w: 300, h: 30, color: '#475569' }, // Mid
  { x: 3050, y: 100, w: 250, h: 30, color: '#475569' }, // Mid-high
  { x: 2600, y: -100, w: 400, h: 35, color: '#475569' }, // High sniper perch

  // Vertical connectors - Small platforms for jetpack navigation
  { x: 200, y: 400, w: 150, h: 25, color: '#475569' },
  { x: 1650, y: 400, w: 150, h: 25, color: '#475569' },
  { x: 400, y: 100, w: 120, h: 25, color: '#475569' },
  { x: 1480, y: 100, w: 120, h: 25, color: '#475569' },

  // Close-quarters areas - Lower platforms with cover
  { x: 100, y: 750, w: 200, h: 30, color: '#475569' },
  { x: 1700, y: 750, w: 200, h: 30, color: '#475569' },
];

// Hold The Flag Map - focused on central control
export const getHTFPlatforms = (): Omit<Platform, 'id'>[] => [
  ...getCTFPlatforms(),
  // Central hill and pedestal
  { x: 850, y: 550, w: 500, h: 50, color: '#475569' },
  { x: 980, y: 420, w: 40, h: 30, color: '#d97706' },
  // Ramps for assaulting the hill
  { x: 700, y: 500, w: 100, h: 20, color: '#3b82f6' },
  { x: 1580, y: 500, w: 100, h: 20, color: '#ef4444' },
  // Watch towers
  { x: 600, y: 300, w: 80, h: 200, color: '#334155' },
  { x: 1720, y: 300, w: 80, h: 200, color: '#334155' },
];

// Infiltration Map - attacker spawn far from defender base
export const getInfiltrationPlatforms = (): Omit<Platform, 'id'>[] => [
  { x: -2000, y: 800, w: 5200, h: 200, color: '#1f2937' },
  // Defender bastion
  { x: 2600, y: 200, w: 500, h: 40, color: '#ef4444' },
  { x: 2500, y: 400, w: 400, h: 30, color: '#ef4444' },
  { x: 2600, y: 600, w: 500, h: 30, color: '#ef4444' },
  { x: 2600, y: 0, w: 300, h: 30, color: '#ef4444' },
  { x: 2800, y: -200, w: 250, h: 30, color: '#ef4444' },
  // Mid approaches
  { x: 1400, y: 500, w: 400, h: 40, color: '#475569' },
  { x: 1600, y: 300, w: 260, h: 30, color: '#475569' },
  { x: 1200, y: 150, w: 200, h: 30, color: '#475569' },
  { x: 800, y: 350, w: 220, h: 30, color: '#475569' },
  // Attacker staging
  { x: -1400, y: 400, w: 400, h: 40, color: '#3b82f6' },
  { x: -1200, y: 200, w: 220, h: 30, color: '#3b82f6' },
  { x: -800, y: 500, w: 260, h: 30, color: '#3b82f6' },
  { x: -600, y: 300, w: 220, h: 30, color: '#3b82f6' },
];

// Tunnel Map - Complex geometry with ceilings and tunnels
const getTunnelMapPlatforms = (): Omit<Platform, 'id'>[] => [
  // Main ground
  { x: -2000, y: 900, w: 6000, h: 200, color: '#334155' },
  // Ceiling (World Top)
  { x: -2000, y: -1000, w: 6000, h: 200, color: '#334155' },
  // Left Wall
  { x: -2000, y: -800, w: 200, h: 1700, color: '#334155' },
  // Right Wall
  { x: 3800, y: -800, w: 200, h: 1700, color: '#334155' },

  // --- Central Complex ---
  // Main central block
  { x: 600, y: 200, w: 800, h: 400, color: '#475569' },
  // Horizontal tunnel through center
  { x: 500, y: 350, w: 1000, h: 40, color: '#475569' }, // Floor of tunnel
  { x: 500, y: 200, w: 1000, h: 40, color: '#475569' }, // Ceiling of tunnel

  // --- Left Tunnels ---
  // Lower tunnel
  { x: -1000, y: 600, w: 800, h: 40, color: '#475569' },
  { x: -1000, y: 450, w: 800, h: 40, color: '#475569' },
  // Upper tunnel
  { x: -1200, y: 100, w: 800, h: 40, color: '#475569' },
  { x: -1200, y: -50, w: 800, h: 40, color: '#475569' },

  // --- Right Tunnels ---
  // Zig-zag structure
  { x: 2200, y: 600, w: 600, h: 40, color: '#475569' },
  { x: 2400, y: 400, w: 600, h: 40, color: '#475569' },
  { x: 2200, y: 200, w: 600, h: 40, color: '#475569' },

  // --- Vertical Shafts ---
  // Left shaft walls
  { x: -100, y: -200, w: 40, h: 800, color: '#475569' },
  { x: 100, y: -200, w: 40, h: 800, color: '#475569' },

  // Right shaft walls
  { x: 1900, y: -200, w: 40, h: 800, color: '#475569' },
  { x: 2100, y: -200, w: 40, h: 800, color: '#475569' },

  // --- Floating Islands ---
  { x: 800, y: -400, w: 400, h: 40, color: '#475569' },
  { x: -600, y: -600, w: 300, h: 40, color: '#475569' },
  { x: 2600, y: -600, w: 300, h: 40, color: '#475569' },
];

// Hunger Games Map - large open with scattered high/low ground
const getHungerPlatforms = (): Omit<Platform, 'id'>[] => [
  // Outer bounds floor/ceiling/walls
  { x: -3000, y: 1400, w: 9000, h: 600, color: '#1f2937' }, // thicker floor
  { x: -3000, y: -2000, w: 200, h: 4000, color: '#1f2937' },
  { x: 5800, y: -2000, w: 200, h: 4000, color: '#1f2937' },
  { x: -3000, y: -2000, w: 9000, h: 180, color: '#1f2937' },

  // Central ring
  { x: -400, y: 1200, w: 1600, h: 60, color: '#475569' },
  { x: 1000, y: 900, w: 800, h: 50, color: '#475569' },
  { x: -800, y: 900, w: 800, h: 50, color: '#475569' },

  // Quadrant platforms
  { x: -2000, y: 1300, w: 500, h: 50, color: '#334155' },
  { x: -2400, y: 800, w: 400, h: 50, color: '#334155' },
  { x: -2000, y: 300, w: 500, h: 50, color: '#334155' },
  { x: -2300, y: -200, w: 400, h: 50, color: '#334155' },

  { x: 2800, y: 1300, w: 500, h: 50, color: '#334155' },
  { x: 3200, y: 800, w: 400, h: 50, color: '#334155' },
  { x: 2800, y: 300, w: 500, h: 50, color: '#334155' },
  { x: 3100, y: -200, w: 400, h: 50, color: '#334155' },

  // Elevated sniping islands
  { x: -600, y: -600, w: 400, h: 50, color: '#64748b' },
  { x: 2000, y: -650, w: 400, h: 50, color: '#64748b' },
  { x: 700, y: -900, w: 500, h: 50, color: '#64748b' },

  // Scatter cover
  { x: -1200, y: 500, w: 260, h: 40, color: '#475569' },
  { x: 1400, y: 400, w: 260, h: 40, color: '#475569' },
  { x: 400, y: 600, w: 260, h: 40, color: '#475569' },
  { x: 2200, y: 600, w: 260, h: 40, color: '#475569' },
];

// Mode-aware platform getter
export const getPlatforms = (mode?: GameMode, mapId?: MapId): Platform[] => {
  let plats: Omit<Platform, 'id'>[] = [];

  // Only Deathmatch can switch maps; other modes stay on legacy layouts.
  if (mode === GameMode.DEATHMATCH) {
    if (mapId === MapId.TUNNELS) plats = getTunnelMapPlatforms();
    else plats = getDeathmatchPlatforms();
  } else if (mode === GameMode.HUNGER_GAMES) {
    plats = getHungerPlatforms();
  } else if (mode === GameMode.HOLD_THE_FLAG) {
    plats = getHTFPlatforms();
  } else if (mode === GameMode.INFILTRATION) {
    plats = getInfiltrationPlatforms();
  } else {
    plats = getCTFPlatforms();
  }

  // Inject IDs
  return plats.map((p, i) => ({ ...p, id: `plat_${mode || 'any'}_${mapId || 'any'}_${i}` }));
};

export const getWaypoints = (mode?: GameMode): { x: number; y: number }[] => {
  const plats = getPlatforms(mode);
  const mids = plats.map(p => ({ x: p.x + p.w / 2, y: p.y - 20 }));

  if (mode === GameMode.DEATHMATCH) {
    // Additional strategic waypoints for Deathmatch map
    return [
      // Left side waypoints
      { x: -1300, y: 850 },
      { x: -1200, y: 650 },
      { x: -1100, y: 450 },
      { x: -1200, y: 250 },
      { x: -1300, y: 50 },
      { x: -1300, y: -150 },
      // Left-center
      { x: -400, y: 600 },
      { x: -450, y: 350 },
      { x: -200, y: 100 },
      // Center waypoints
      { x: 1000, y: 850 },
      { x: 1000, y: 650 },
      { x: 1000, y: 450 },
      { x: 1000, y: 200 },
      { x: 1000, y: -50 },
      { x: 800, y: -300 },
      // Right-center
      { x: 2200, y: 600 },
      { x: 2300, y: 350 },
      { x: 2250, y: 100 },
      // Right side waypoints
      { x: 3000, y: 850 },
      { x: 3200, y: 650 },
      { x: 2850, y: 450 },
      { x: 3150, y: 250 },
      { x: 2800, y: 50 },
      { x: 2800, y: -150 },
      ...mids,
    ];
  }

  if (mode === GameMode.INFILTRATION) {
    return [
      { x: -1200, y: 250 },
      { x: -800, y: 480 },
      { x: 0, y: 500 },
      { x: 800, y: 330 },
      { x: 1200, y: 120 },
      { x: 1600, y: 280 },
      { x: 2000, y: 520 },
      { x: 2600, y: 180 },
      { x: 2800, y: -50 },
      { x: 2800, y: 450 },
      ...mids,
    ];
  }

  if (mode === GameMode.HOLD_THE_FLAG) {
    return [
      { x: 1000, y: 450 },
      { x: 850, y: 520 },
      { x: 1150, y: 520 },
      { x: 700, y: 480 },
      { x: 1580, y: 480 },
      { x: 600, y: 260 },
      { x: 1720, y: 260 },
      ...mids,
    ];
  }

  if (mode === GameMode.HUNGER_GAMES) {
    return [
      { x: 0, y: 1100 },
      { x: 1200, y: 1100 },
      { x: -1200, y: 1100 },
      { x: 3000, y: 700 },
      { x: -2200, y: 700 },
      { x: 700, y: -500 },
      { x: 2000, y: -450 },
      ...mids,
    ];
  }

  // CTF waypoints
  return [
    { x: -400, y: 700 },
    { x: 200, y: 400 },
    { x: 1000, y: 450 },
    { x: 1100, y: 300 },
    { x: 1800, y: 200 },
    { x: 2400, y: 450 },
    ...mids,
  ];
};

export const getInitialPickups = (mode: GameMode, mapId?: string): Pickup[] => {
  // Gun Game: no weapon pickups at all
  if (mode === GameMode.GUN_GAME) {
    return [
      { id: 'gg_hp_center_low', type: ItemType.HEALTH, pos: { x: 1000, y: 660 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_center_mid', type: ItemType.HEALTH, pos: { x: 1000, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_center_high', type: ItemType.HEALTH, pos: { x: 1000, y: 210 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_left_mid', type: ItemType.HEALTH, pos: { x: -1200, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_right_mid', type: ItemType.HEALTH, pos: { x: 3000, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_left_low', type: ItemType.HEALTH, pos: { x: -400, y: 610 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_hp_right_low', type: ItemType.HEALTH, pos: { x: 2200, y: 610 }, active: true, respawnTime: 0, value: 25 },
      { id: 'gg_armor_center', type: ItemType.ARMOR, pos: { x: 1000, y: 210 }, active: true, respawnTime: 0, value: 50 },
      { id: 'gg_armor_left_high', type: ItemType.ARMOR, pos: { x: -1200, y: 60 }, active: true, respawnTime: 0, value: 50 },
      { id: 'gg_armor_right_high', type: ItemType.ARMOR, pos: { x: 3150, y: 60 }, active: true, respawnTime: 0, value: 50 },
      { id: 'gg_fuel_left', type: ItemType.FUEL, pos: { x: -1100, y: 260 }, active: true, respawnTime: 0, value: 150 },
      { id: 'gg_fuel_right', type: ItemType.FUEL, pos: { x: 2850, y: 260 }, active: true, respawnTime: 0, value: 150 },
      { id: 'gg_fuel_center_low', type: ItemType.FUEL, pos: { x: 1000, y: 660 }, active: true, respawnTime: 0, value: 150 },
    ];
  }

  if (mapId === 'tunnels') {
    // Tunnels map pickups - focused on close quarters and verticality
    return [
      // Weapons
      { id: 'tun_rl_center', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 550, y: 310 }, active: true, respawnTime: 0, value: 0 }, // tunnel mouth (the block itself is solid)
      { id: 'tun_sg_left', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: -600, y: 550 }, active: true, respawnTime: 0, value: 0 },
      { id: 'tun_sg_right', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: 2500, y: 550 }, active: true, respawnTime: 0, value: 0 },
      { id: 'tun_gl_top', type: ItemType.WEAPON, subtype: WeaponType.GRENADE_LAUNCHER, pos: { x: 1000, y: -450 }, active: true, respawnTime: 0, value: 0 },
      { id: 'tun_cs_mid', type: ItemType.WEAPON, subtype: WeaponType.CHAINSAW, pos: { x: 1450, y: 310 }, active: true, respawnTime: 0, value: 0 },
      { id: 'tun_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 2600, y: 360 }, active: true, respawnTime: 0, value: 0 }, // middle zig-zag step, covered from above by the upper one

      // Health/Armor
      { id: 'tun_hp_mid', type: ItemType.HEALTH, pos: { x: 1000, y: 150 }, active: true, respawnTime: 0, value: 25 },
      { id: 'tun_arm_mid', type: ItemType.ARMOR, pos: { x: 1000, y: 860 }, active: true, respawnTime: 0, value: 50 },
      { id: 'tun_hp_left', type: ItemType.HEALTH, pos: { x: -1100, y: 400 }, active: true, respawnTime: 0, value: 25 },
      { id: 'tun_hp_right', type: ItemType.HEALTH, pos: { x: 2300, y: 400 }, active: true, respawnTime: 0, value: 25 },

      // Fuel
      { id: 'tun_fuel_shaft_l', type: ItemType.FUEL, pos: { x: 0, y: 200 }, active: true, respawnTime: 0, value: 150 },
      { id: 'tun_fuel_shaft_r', type: ItemType.FUEL, pos: { x: 2000, y: 200 }, active: true, respawnTime: 0, value: 150 },
    ];
  }

  if (mode === GameMode.HUNGER_GAMES) {
    return [
      { id: 'hg_rl', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 0, y: 1050 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_sg_left', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: -1600, y: 1250 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_sg_right', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: 3200, y: 1250 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_plasma_high', type: ItemType.WEAPON, subtype: WeaponType.PLASMA_GUN, pos: { x: 700, y: -950 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_rail_left', type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x: -600, y: -650 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_rail_right', type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x: 2000, y: -700 }, active: true, respawnTime: 0, value: 0 },
      { id: 'hg_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 1530, y: 350 }, active: true, respawnTime: 0, value: 0 }, // on the scatter-cover slab, out in the open
      { id: 'hg_hp_center', type: ItemType.HEALTH, pos: { x: 0, y: 1000 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hg_hp_left', type: ItemType.HEALTH, pos: { x: -2300, y: 750 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hg_hp_right', type: ItemType.HEALTH, pos: { x: 3200, y: 750 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hg_armor_mid', type: ItemType.ARMOR, pos: { x: 1000, y: 850 }, active: true, respawnTime: 0, value: 50 },
      { id: 'hg_armor_left', type: ItemType.ARMOR, pos: { x: -1800, y: 350 }, active: true, respawnTime: 0, value: 50 },
      { id: 'hg_armor_right', type: ItemType.ARMOR, pos: { x: 2800, y: 350 }, active: true, respawnTime: 0, value: 50 },
      { id: 'hg_fuel_left', type: ItemType.FUEL, pos: { x: -1200, y: 520 }, active: true, respawnTime: 0, value: 150 },
      { id: 'hg_fuel_right', type: ItemType.FUEL, pos: { x: 2200, y: 520 }, active: true, respawnTime: 0, value: 150 },
      { id: 'hg_fuel_high', type: ItemType.FUEL, pos: { x: 700, y: -600 }, active: true, respawnTime: 0, value: 150 },
      { id: 'hg_ammo_ring', type: ItemType.AMMO, pos: { x: 0, y: 1200 }, active: true, respawnTime: 0, value: 30 },
      { id: 'hg_ammo_left', type: ItemType.AMMO, pos: { x: -2300, y: 1200 }, active: true, respawnTime: 0, value: 30 },
      { id: 'hg_ammo_right', type: ItemType.AMMO, pos: { x: 3200, y: 1200 }, active: true, respawnTime: 0, value: 30 },
    ];
  }

  if (mode === GameMode.HOLD_THE_FLAG) {
    return [
      { id: 'htf_flag', type: ItemType.FLAG, team: Team.NONE, pos: HTF_FLAG_POS, active: true, respawnTime: 0, value: 0 },
      { id: 'htf_hp_left', type: ItemType.HEALTH, pos: { x: 900, y: 520 }, active: true, respawnTime: 0, value: 25 },
      { id: 'htf_hp_right', type: ItemType.HEALTH, pos: { x: 1100, y: 520 }, active: true, respawnTime: 0, value: 25 },
      { id: 'htf_armor_left', type: ItemType.ARMOR, pos: { x: 760, y: 470 }, active: true, respawnTime: 0, value: 50 },
      { id: 'htf_armor_right', type: ItemType.ARMOR, pos: { x: 1640, y: 470 }, active: true, respawnTime: 0, value: 50 },
      { id: 'htf_ammo_mid', type: ItemType.AMMO, pos: { x: 1000, y: 460 }, active: true, respawnTime: 0, value: 30 },
      { id: 'htf_weapon_rl', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 1000, y: 380 }, active: true, respawnTime: 0, value: 0 },
      { id: 'htf_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 1250, y: 520 }, active: true, respawnTime: 0, value: 0 }, // right end of the hill, beside the flag
    ];
  }

  if (mode === GameMode.DEATHMATCH) {
    // Deathmatch pickups - Strategic placement across the larger map
    return [
      // Weapons - Strategic positions
      { id: 'weapon_railgun_left', type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x: -1300, y: -140 }, active: true, respawnTime: 0, value: 0 }, // Left sniper perch
      { id: 'weapon_railgun_right', type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x: 2800, y: -140 }, active: true, respawnTime: 0, value: 0 }, // Right sniper perch
      { id: 'weapon_rocket', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 1000, y: -40 }, active: true, respawnTime: 0, value: 0 }, // Top center - contested
      { id: 'weapon_shotgun_left', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: 200, y: 720 }, active: true, respawnTime: 0, value: 0 }, // Close-quarters left
      { id: 'weapon_shotgun_right', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: 1800, y: 720 }, active: true, respawnTime: 0, value: 0 }, // Close-quarters right
      { id: 'weapon_grenade', type: ItemType.WEAPON, subtype: WeaponType.GRENADE_LAUNCHER, pos: { x: 800, y: -290 }, active: true, respawnTime: 0, value: 0 }, // Elevated sniper spot
      { id: 'weapon_chainsaw_mid', type: ItemType.WEAPON, subtype: WeaponType.CHAINSAW, pos: { x: 400, y: 560 }, active: true, respawnTime: 0, value: 0 }, // Aggressive close-range option near mid
      { id: 'weapon_plasma_left', type: ItemType.WEAPON, subtype: WeaponType.PLASMA_GUN, pos: { x: -1300, y: 70 }, active: true, respawnTime: 0, value: 0 }, // Mid-high left
      { id: 'weapon_plasma_right', type: ItemType.WEAPON, subtype: WeaponType.PLASMA_GUN, pos: { x: 3050, y: 70 }, active: true, respawnTime: 0, value: 0 }, // Mid-high right
      { id: 'weapon_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 1250, y: 660 }, active: true, respawnTime: 0, value: 0 }, // Lower center, beside the mid-center cover

      // Health - Distributed across levels
      { id: 'hp_center_low', type: ItemType.HEALTH, pos: { x: 1000, y: 660 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_center_mid', type: ItemType.HEALTH, pos: { x: 1000, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_center_high', type: ItemType.HEALTH, pos: { x: 1000, y: 210 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_left_mid', type: ItemType.HEALTH, pos: { x: -1200, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_right_mid', type: ItemType.HEALTH, pos: { x: 3000, y: 460 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_left_low', type: ItemType.HEALTH, pos: { x: -400, y: 610 }, active: true, respawnTime: 0, value: 25 },
      { id: 'hp_right_low', type: ItemType.HEALTH, pos: { x: 2200, y: 610 }, active: true, respawnTime: 0, value: 25 },

      // Armor - Strategic positions
      { id: 'armor_center', type: ItemType.ARMOR, pos: { x: 1000, y: 210 }, active: true, respawnTime: 0, value: 50 }, // Upper center - contested
      { id: 'armor_left_high', type: ItemType.ARMOR, pos: { x: -1200, y: 60 }, active: true, respawnTime: 0, value: 50 },
      { id: 'armor_right_high', type: ItemType.ARMOR, pos: { x: 3150, y: 60 }, active: true, respawnTime: 0, value: 50 },
      { id: 'armor_left_center', type: ItemType.ARMOR, pos: { x: -450, y: 360 }, active: true, respawnTime: 0, value: 50 },
      { id: 'armor_right_center', type: ItemType.ARMOR, pos: { x: 2300, y: 360 }, active: true, respawnTime: 0, value: 50 },

      // Fuel - Encourages vertical movement
      { id: 'fuel_left', type: ItemType.FUEL, pos: { x: -1100, y: 260 }, active: true, respawnTime: 0, value: 150 },
      { id: 'fuel_right', type: ItemType.FUEL, pos: { x: 2850, y: 260 }, active: true, respawnTime: 0, value: 150 },
      { id: 'fuel_center_low', type: ItemType.FUEL, pos: { x: 1000, y: 660 }, active: true, respawnTime: 0, value: 150 },
      { id: 'fuel_left_connector', type: ItemType.FUEL, pos: { x: 400, y: 60 }, active: true, respawnTime: 0, value: 150 },
      { id: 'fuel_right_connector', type: ItemType.FUEL, pos: { x: 1550, y: 60 }, active: true, respawnTime: 0, value: 150 },

      // Ammo - Scattered throughout
      { id: 'ammo_center', type: ItemType.AMMO, pos: { x: 1000, y: 460 }, active: true, respawnTime: 0, value: 30 },
      { id: 'ammo_left', type: ItemType.AMMO, pos: { x: -1200, y: 660 }, active: true, respawnTime: 0, value: 30 },
      { id: 'ammo_right', type: ItemType.AMMO, pos: { x: 3000, y: 660 }, active: true, respawnTime: 0, value: 30 },
      { id: 'ammo_sniper_left', type: ItemType.AMMO, pos: { x: -1300, y: -140 }, active: true, respawnTime: 0, value: 30 },
      { id: 'ammo_sniper_right', type: ItemType.AMMO, pos: { x: 2800, y: -140 }, active: true, respawnTime: 0, value: 30 },
    ];
  }

  if (mode === GameMode.INFILTRATION) {
    return [
      { id: 'intel_objective', type: ItemType.INTEL, team: Team.RED, pos: { ...INTEL_POS }, active: true, respawnTime: -1, value: 1000 },
      { id: 'inf_hp_mid', type: ItemType.HEALTH, pos: { x: 1400, y: 470 }, active: true, respawnTime: 0, value: 25 },
      { id: 'inf_hp_attack', type: ItemType.HEALTH, pos: { x: -1100, y: 370 }, active: true, respawnTime: 0, value: 25 },
      { id: 'inf_armor_mid', type: ItemType.ARMOR, pos: { x: 1600, y: 270 }, active: true, respawnTime: 0, value: 50 },
      { id: 'inf_ammo_mid', type: ItemType.AMMO, pos: { x: 1200, y: 120 }, active: true, respawnTime: 0, value: 30 },
      { id: 'inf_weapon_rl', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 800, y: 320 }, active: true, respawnTime: 0, value: 0 },
      { id: 'inf_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 1650, y: 470 }, active: true, respawnTime: 0, value: 0 }, // mid approach to the bastion, under the upper slab
      { id: 'inf_fuel_attack', type: ItemType.FUEL, pos: { x: -800, y: 470 }, active: true, respawnTime: 0, value: 150 },
    ];
  }

  // Gun Game block removed (duplicate)

  // CTF pickups - Original layout
  const pickups: Pickup[] = [
    { id: 'hp_mid', type: ItemType.HEALTH, pos: { x: 1000, y: 550 }, active: true, respawnTime: 0, value: 25 },
    { id: 'armor_mid', type: ItemType.ARMOR, pos: { x: 900, y: 360 }, active: true, respawnTime: 0, value: 50 },
    { id: 'ammo_mid', type: ItemType.AMMO, pos: { x: 1000, y: 360 }, active: true, respawnTime: 0, value: 30 },
    { id: 'hp_blue', type: ItemType.HEALTH, pos: { x: -200, y: 470 }, active: true, respawnTime: 0, value: 25 },
    { id: 'hp_red', type: ItemType.HEALTH, pos: { x: 2100, y: 470 }, active: true, respawnTime: 0, value: 25 },
    { id: 'armor_left', type: ItemType.ARMOR, pos: { x: 150, y: 270 }, active: true, respawnTime: 0, value: 50 },
    { id: 'armor_right', type: ItemType.ARMOR, pos: { x: 1800, y: 270 }, active: true, respawnTime: 0, value: 50 },
    { id: 'fuel_left', type: ItemType.FUEL, pos: { x: -300, y: 600 }, active: true, respawnTime: 0, value: 150 },
    { id: 'fuel_right', type: ItemType.FUEL, pos: { x: 2300, y: 600 }, active: true, respawnTime: 0, value: 150 },
    // Weapons
    { id: 'weapon_shotgun', type: ItemType.WEAPON, subtype: WeaponType.SHOTGUN, pos: { x: 300, y: 270 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_rocket', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 1000, y: -170 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_sniper', type: ItemType.WEAPON, subtype: WeaponType.RAILGUN, pos: { x: 1700, y: -70 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_chainsaw', type: ItemType.WEAPON, subtype: WeaponType.CHAINSAW, pos: { x: 1100, y: 520 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_plasma_blue', type: ItemType.WEAPON, subtype: WeaponType.PLASMA_GUN, pos: { x: -500, y: 470 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_plasma_red', type: ItemType.WEAPON, subtype: WeaponType.PLASMA_GUN, pos: { x: 2200, y: 470 }, active: true, respawnTime: 0, value: 0 },
    { id: 'weapon_smoke', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 850, y: 560 }, active: true, respawnTime: 0, value: 0 }, // midfield, under the central slab: neutral to both teams
  ];

  if (mode === GameMode.CTF) {
    pickups.push(
      { id: 'flag_blue', type: ItemType.FLAG, team: Team.BLUE, pos: baseFlagPos(Team.BLUE), active: true, respawnTime: 0, value: 0 },
      { id: 'flag_red', type: ItemType.FLAG, team: Team.RED, pos: baseFlagPos(Team.RED), active: true, respawnTime: 0, value: 0 },
    );
  }

  return pickups;
};
