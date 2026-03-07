
export type Vector2 = { x: number; y: number };

export type Language = 'en' | 'ru';

export enum GameMode {
  DEATHMATCH = 'DEATHMATCH',
  GUN_GAME = 'GUN_GAME',
  CTF = 'CTF',
  HOLD_THE_FLAG = 'HOLD_THE_FLAG',
  INFILTRATION = 'INFILTRATION',
  HUNGER_GAMES = 'HUNGER_GAMES',
}

export enum Team {
  NONE = 'NONE',
  BLUE = 'BLUE',
  RED = 'RED',
}

export enum WeaponType {
  MACHINE_GUN = 'MACHINE_GUN',
  SHOTGUN = 'SHOTGUN',
  ROCKET_LAUNCHER = 'ROCKET_LAUNCHER',
  RAILGUN = 'RAILGUN',
  PLASMA_GUN = 'PLASMA_GUN',
  GRENADE_LAUNCHER = 'GRENADE_LAUNCHER',
  CHAINSAW = 'CHAINSAW',
}

export enum ItemType {
  HEALTH = 'HEALTH',
  ARMOR = 'ARMOR',
  AMMO = 'AMMO',
  WEAPON = 'WEAPON',
  FLAG = 'FLAG',
  FUEL = 'FUEL',
  INTEL = 'INTEL',
}

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

export interface Pickup {
  id: string;
  type: ItemType;
  subtype?: WeaponType; // Specific weapon type if ItemType.WEAPON
  team?: Team; // For Flags
  pos: Vector2;
  active: boolean;
  respawnTime: number; // timestamp when it respawns
  value: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  color: string;
  headColor?: string;
  torsoColor?: string;
  armColor?: string;
  legColor?: string;
  isGrounded: boolean;
  isCrouching: boolean;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  jetpackFuel: number;
  maxFuel: number;
  jetpackColor: string;
  dead: boolean;
  respawnTimer: number;
  team: Team;
  facingRight: boolean;
  weapon: Weapon;
  inventory: Weapon[]; // List of unlocked weapons
  lastFired: number;
  type: 'player' | 'bot';
  skinId: string;
  name: string; // Player display name
  score: number;
  grapple: {
    active: boolean;
    pos: Vector2; // where it hooked
    length: number;
  };
  gunLevel?: number;
  gunProgress?: number;
  lastDash: number;
  hasFlag: Team; // Team of the flag carried (NONE if none)
  lastProcessedInput: number; // Sequence number of the last processed input
  hungerOutTimer?: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  pos: Vector2;
  vel: Vector2;
  type: WeaponType;
  radius: number;
  active: boolean;
  life?: number; // For grenades
}

export interface Particle {
  id: string;
  pos: Vector2;
  vel: Vector2;
  life: number; // 0 to 1
  decay: number;
  color: string;
  size: number;
  type?: 'blood' | 'spark' | 'smoke' | 'fire' | 'shell';
  rotation?: number;
}

export interface Decal {
  id: string;
  pos: Vector2;
  rotation: number;
  scale: number;
  color: number;
  alpha: number;
  createdAt?: number; // Timestamp for cleanup
}

export interface FloatingText {
  id: string;
  pos: Vector2;
  text: string;
  color: string;
  life: number;
  velY: number;
}

export interface KillMessage {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  time: number;
  killerColor: string;
  victimColor: string;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RagdollPart {
  id: string;
  type: 'head' | 'torso' | 'arm-left' | 'arm-right' | 'leg-left' | 'leg-right';
  pos: Vector2;
  vel: Vector2;
  rotation: number;
  angularVel: number;
  color: string;
  life: number;
  isGrounded: boolean;
  hungerOutTimer?: number;
}

export interface Beam {
  id: string;
  start: Vector2;
  end: Vector2;
  color: string;
  life: number; // 0 to 1
  width: number;
}

export interface GameState {
  mode: GameMode;
  scores: { [key in Team]: number };
  players: Entity[];
  projectiles: Projectile[];
  particles: Particle[];
  decals: Decal[];
  floatingTexts: FloatingText[];
  platforms: Platform[];
  pickups: Pickup[];
  camera: Camera;
  ragdollParts: RagdollPart[];
  lastHTFScore?: number;
  infiltrationEndTime?: number;
  currentMap: MapId;
  hungerZone?: { x: number; y: number; w: number; h: number; lastShrink?: number; pendingShrink?: boolean; nextShrinkAt?: number; pendingCount?: number };
  hungerWinnerId?: string | null;
  gunGameWinnerId?: string | null;
  beams: Beam[];
}

export enum MapId {
  DEFAULT = 'default',
  TUNNELS = 'tunnels',
  HUNGER = 'hunger'
}

export enum NetworkMode {
  OFFLINE = 'OFFLINE',
  HOST = 'HOST',
  CLIENT = 'CLIENT',
}

export interface PlayerInput {
  keys: { [key: string]: boolean };
  mouse: { x: number; y: number };
  mousePressed: boolean;
  hookPressed: boolean;
  timestamp: number;
  sequence: number; // For client-side prediction reconciliation
}

export type NetworkPacket =
  | { type: 'HANDSHAKE'; playerId: string; name: string; color: string; skinId: string }
  | { type: 'STATE_UPDATE'; state: GameState; timestamp: number }
  | { type: 'INPUT'; input: PlayerInput; playerId: string };
