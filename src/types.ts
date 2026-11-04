
import type { FighterBuild } from './game/build/buildParts';
import type { Corpse } from './game/systems/ragdoll/corpseBody';
import type { Cover } from './game/cover/coverTypes';

export type Vector2 = { x: number; y: number };

export type Language = 'en' | 'ru';

export enum GameMode {
  DEATHMATCH = 'DEATHMATCH',
  GUN_GAME = 'GUN_GAME',
  CTF = 'CTF',
  HOLD_THE_FLAG = 'HOLD_THE_FLAG',
  INFILTRATION = 'INFILTRATION',
  HUNGER_GAMES = 'HUNGER_GAMES',
  DUEL = 'DUEL', // tournament-only 1v1 on The Pit; not offered in the mode menu
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
  SMOKE_LAUNCHER = 'SMOKE_LAUNCHER',
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

/** A leg lost to a railgun beam through armor; `by` is the shooter who gets the frag if it bleeds out. */
export interface Wound { by: string }

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
  isProne?: boolean; // lying down (missing from older hosts: never lying)
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
  build?: FighterBuild; // Chosen parts; missing means the preset of skinId
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
  aim?: number; // Aim angle in radians (lets other clients render where this player points)
  jetpackOn?: boolean; // Jetpack thrusting this tick (lets other clients draw the flame)
  hungerOutTimer?: number;
  wound?: Wound; // lost a leg to a railgun through armor (missing from older hosts: whole)
  spawnShieldUntil?: number; // can't be hurt before this timestamp, right after a respawn (spawnShield.ts)
}

export interface Projectile {
  id: string;
  ownerId: string;
  pos: Vector2;
  vel: Vector2;
  type: WeaponType;
  radius: number;
  active: boolean;
  life?: number; // Ticks left before the projectile expires (grenades explode)
}

export type ParticleKind = 'blood' | 'spark' | 'smoke' | 'fire' | 'shell' | 'ember' | 'dust' | 'flash' | 'fireball' | 'ring' | 'puff' | 'debris' | 'soot';

export interface Particle {
  id: string;
  pos: Vector2;
  vel: Vector2;
  life: number; // 0 to 1
  decay: number; // Life lost per physics tick
  color: string;
  size: number;
  type?: ParticleKind;
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

export interface Beam {
  id: string;
  start: Vector2;
  end: Vector2;
  color: string;
  life: number; // 0 to 1
  width: number;
}

export interface SmokeCloud {
  id: string;
  pos: Vector2;
  radius: number; // full radius; the live size shrinks during the fade (see smokeRadiusAt)
  bornAt: number; // ms timestamp
  endsAt: number; // ms timestamp
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
  corpses: Corpse[]; // client-only cosmetics: dead fighters as jointed bodies
  lastHTFScore?: number;
  infiltrationEndTime?: number;
  currentMap: MapId;
  hungerZone?: { x: number; y: number; w: number; h: number; lastShrink?: number; pendingShrink?: boolean; nextShrinkAt?: number; pendingCount?: number };
  hungerWinnerId?: string | null;
  hungerRoundEndsAt?: number; // When the finished round restarts (ms timestamp)
  hungerRoundStartedAt?: number; // Round clock start (rounds are time-limited)
  hungerEndReason?: 'last-standing' | 'time';
  betSpectateId?: string | null; // Client-only: Hunger Games spectator follows this player
  gunGameWinnerId?: string | null;
  // Score/time-limited modes (see matchRound.ts)
  matchStartedAt?: number;
  matchEndsAt?: number; // set when the match is over: when the next one starts
  matchWinner?: { team?: Team; playerId?: string } | null; // null = draw
  matchEndReason?: 'score' | 'time';
  beams: Beam[];
  smokes?: SmokeCloud[]; // smoke clouds; readers use `state.smokes ?? []`
  cover?: Cover[]; // destructible cover; readers use `state.cover ?? []`
}

export enum MapId {
  DEFAULT = 'default',
  TUNNELS = 'tunnels',
  HUNGER = 'hunger',
  PIT = 'pit',
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
  weaponIndex?: number; // Selected inventory slot (0-based)
}

