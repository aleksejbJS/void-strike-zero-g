// What the test range (#range) starts with: one dummy per body preset on its ledge, and the
// player's loadout of every weapon. Pure data: GameCanvas adds the result to the game state.

import { DEFAULT_MAX_FUEL, WEAPONS_DATA } from '../../constants';
import { Entity, GameState, Team, Weapon, WeaponType } from '../../types';
import { presetBuild } from '../build/buildPresets';
import { BODY_PRESETS } from '../build/characterBases';
import { DUMMY_SPOTS } from './rangeMap';
import { createRangeState } from './rangeState';

const FIGHTER_WIDTH = 30;
const FIGHTER_HEIGHT = 72;

/** One fresh weapon of every type in enum order, the machine gun first; ammo is never shared between calls. */
export const rangeLoadout = (): Weapon[] =>
    Object.values(WeaponType).map(type => ({ ...WEAPONS_DATA[type] }));

const createDummy = (skinId: string, spot: { x: number; y: number }): Entity => {
    const preset = BODY_PRESETS.find(p => p.id === skinId);
    if (!preset) throw new Error(`Range dummy has no body preset: ${skinId}`);
    const { head, torso, arms, legs, jetpack } = preset.palette;
    const weapon = { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] };
    return {
        id: `dummy_${skinId}`, type: 'bot', dummy: true, name: `${preset.name} dummy`, team: Team.NONE,
        pos: { ...spot }, vel: { x: 0, y: 0 }, width: FIGHTER_WIDTH, height: FIGHTER_HEIGHT,
        skinId, color: preset.color, headColor: head, torsoColor: torso, armColor: arms, legColor: legs,
        jetpackColor: jetpack, build: presetBuild(skinId),
        isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
        jetpackFuel: DEFAULT_MAX_FUEL, maxFuel: DEFAULT_MAX_FUEL, dead: false, respawnTimer: 0,
        facingRight: false, aim: Math.PI, // looking back along the range, at the spawn
        weapon, inventory: [weapon], lastFired: 0, score: 0,
        grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
        lastProcessedInput: 0,
    };
};

/** The five dummies, one per preset, each standing on its own spot. */
export const createDummies = (): Entity[] =>
    DUMMY_SPOTS.map(({ skinId, pos }) => createDummy(skinId, pos));

/** Turns a started offline match into the range: an unhurtable, fully armed player and the dummies. */
export const setupRange = (state: GameState, local: Entity): void => {
    local.invulnerable = true;
    local.inventory = rangeLoadout();
    local.weapon = local.inventory[0];
    state.players.push(...createDummies());
    state.range = createRangeState();
};
