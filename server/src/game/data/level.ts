import { GameMode, ItemType, Platform, Pickup, Team, WeaponType } from '../../types';

const BLUE_FLAG_POS = { x: -350, y: 470 };
const RED_FLAG_POS = { x: 2350, y: 470 };
export const HTF_FLAG_POS = { x: 1000, y: 410 };
export const INTEL_POS = { x: 2800, y: 0 };
export const EXTRACTION_ZONE = { x: -1200, y: 0, w: 200, h: 200 };

export const baseFlagPos = (team: Team) => (team === Team.BLUE ? { ...BLUE_FLAG_POS } : { ...RED_FLAG_POS });

// CTF Map - Original balanced map for Capture The Flag
const getCTFPlatforms = (): Platform[] => [
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
const getDeathmatchPlatforms = (): Platform[] => [
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
export const getHTFPlatforms = (): Platform[] => [
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
export const getInfiltrationPlatforms = (): Platform[] => [
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

// Mode-aware platform getter
export const getPlatforms = (mode?: GameMode): Platform[] => {
  if (mode === GameMode.DEATHMATCH) return getDeathmatchPlatforms();
  if (mode === GameMode.HOLD_THE_FLAG) return getHTFPlatforms();
  if (mode === GameMode.INFILTRATION) return getInfiltrationPlatforms();
  return getCTFPlatforms();
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

export const getInitialPickups = (mode: GameMode): Pickup[] => {
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

  if (mode === GameMode.HOLD_THE_FLAG) {
    return [
      { id: 'htf_flag', type: ItemType.FLAG, team: Team.NONE, pos: HTF_FLAG_POS, active: true, respawnTime: 0, value: 0 },
      { id: 'htf_hp_left', type: ItemType.HEALTH, pos: { x: 900, y: 520 }, active: true, respawnTime: 0, value: 25 },
      { id: 'htf_hp_right', type: ItemType.HEALTH, pos: { x: 1100, y: 520 }, active: true, respawnTime: 0, value: 25 },
      { id: 'htf_armor_left', type: ItemType.ARMOR, pos: { x: 760, y: 470 }, active: true, respawnTime: 0, value: 50 },
      { id: 'htf_armor_right', type: ItemType.ARMOR, pos: { x: 1640, y: 470 }, active: true, respawnTime: 0, value: 50 },
      { id: 'htf_ammo_mid', type: ItemType.AMMO, pos: { x: 1000, y: 460 }, active: true, respawnTime: 0, value: 30 },
      { id: 'htf_weapon_rl', type: ItemType.WEAPON, subtype: WeaponType.ROCKET_LAUNCHER, pos: { x: 1000, y: 380 }, active: true, respawnTime: 0, value: 0 },
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
      { id: 'inf_fuel_attack', type: ItemType.FUEL, pos: { x: -800, y: 470 }, active: true, respawnTime: 0, value: 150 },
    ];
  }

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
  ];

  if (mode === GameMode.CTF) {
    pickups.push(
      { id: 'flag_blue', type: ItemType.FLAG, team: Team.BLUE, pos: baseFlagPos(Team.BLUE), active: true, respawnTime: 0, value: 0 },
      { id: 'flag_red', type: ItemType.FLAG, team: Team.RED, pos: baseFlagPos(Team.RED), active: true, respawnTime: 0, value: 0 },
    );
  }

  return pickups;
};
