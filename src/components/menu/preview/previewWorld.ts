// The little world the mode previews play in: the visible area, its platforms, and the
// entities that stand in for players. World px are game px; the view shows them at VIEW_SCALE.

import { Entity, GameMode, GameState, MapId, Platform, Team, Vector2, WeaponType } from '../../../types';
import { WEAPONS_DATA } from '../../../constants';
import { FighterBuild } from '../../../game/build/buildParts';
import { ActorLook } from './previewScript';
import { BODY_PRESETS } from '../../../game/build/characterBases';
import { presetBuild } from '../../../game/build/buildPresets';

export const STAGE_W = 620;  // CSS px, same as the menu's Stage
export const STAGE_H = 340;
export const VIEW_SCALE = 0.7;
export const WORLD_W = STAGE_W / VIEW_SCALE;
export const WORLD_H = STAGE_H / VIEW_SCALE;

/** Deck heights, so scripts can stand actors on them. */
export const FLOOR_Y = 430;
export const LOW_Y = 300;
export const TOP_Y = 185;

/** Floor plus three decks: low left, low right, top middle (like the old schematic stage). */
export const PREVIEW_PLATFORMS: Platform[] = [
    { id: 'pv_floor', x: -300, y: FLOOR_Y, w: WORLD_W + 600, h: 200, color: '#334155' },
    { id: 'pv_left', x: 60, y: LOW_Y, w: 240, h: 32, color: '#475569' },
    { id: 'pv_right', x: WORLD_W - 300, y: LOW_Y, w: 240, h: 32, color: '#475569' },
    { id: 'pv_top', x: WORLD_W / 2 - 130, y: TOP_Y, w: 260, h: 32, color: '#64748b' },
];

/** Middle of the view in world px. */
export const VIEW_CENTER: Vector2 = { x: WORLD_W / 2, y: WORLD_H / 2 };

/** World point → CSS px inside the stage (for HTML overlays). */
export const toStage = (p: Vector2): Vector2 => ({ x: p.x * VIEW_SCALE, y: p.y * VIEW_SCALE });

export interface YouLook {
    head: string;
    torso: string;
    arms: string;
    legs: string;
    jetpack: string;
    skinId: string;
    build: FighterBuild;
}

const BOT_COLORS: Record<Exclude<ActorLook, 'you'>, string> = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e' };

const colorsOf = (look: ActorLook, you: YouLook) => {
    if (look === 'you') {
        return {
            color: you.torso, headColor: you.head, torsoColor: you.torso, armColor: you.arms,
            legColor: you.legs, jetpackColor: you.jetpack, skinId: you.skinId, build: you.build,
        };
    }
    const c = BOT_COLORS[look];
    const id = look === 'red' ? 'base-robot' : look === 'green' ? 'base-toxic' : 'base-human';
    const preset = BODY_PRESETS.find(p => p.id === id)!;
    return { color: c, headColor: preset.palette.head, torsoColor: c, armColor: preset.palette.arms,
        legColor: preset.palette.legs, jetpackColor: preset.palette.jetpack, skinId: id, build: presetBuild(id) };
};

/** Ids are prefixed so the fighter animator's per-id memory never mixes them with a match's. */
export const actorEntityId = (id: string) => `pv-${id}`;

export const createActorEntity = (id: string, look: ActorLook, team: Team, weapon: WeaponType, you: YouLook): Entity => {
    const w = { ...WEAPONS_DATA[weapon] };
    return {
        id: actorEntityId(id), type: look === 'you' ? 'player' : 'bot', name: id,
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, width: 30, height: 72,
        ...colorsOf(look, you),
        isGrounded: true, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
        jetpackFuel: 100, maxFuel: 100, dead: false, respawnTimer: 0, team,
        facingRight: true, weapon: w, inventory: [w], lastFired: 0, score: 0,
        grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
        lastProcessedInput: 0, jetpackOn: false,
    };
};

export const createPreviewState = (mode: GameMode, map: MapId): GameState => ({
    mode,
    currentMap: map,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    decals: [],
    floatingTexts: [],
    platforms: PREVIEW_PLATFORMS,
    pickups: [],
    // The world is drawn scaled: the renderer centres the camera at screen centre in unscaled
    // px, so the camera is given pre-scaled (see PreviewCanvas)
    camera: { x: VIEW_CENTER.x * VIEW_SCALE, y: VIEW_CENTER.y * VIEW_SCALE, zoom: 1 },
    corpses: [],
    beams: [],
    smokes: [],
});
