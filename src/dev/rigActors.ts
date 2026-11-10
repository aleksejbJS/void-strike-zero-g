// Reusable visual inspection actors: source assembly and the real in-game fighter renderer.
import { Container, Texture } from 'pixi.js';
import { WeaponType } from '../types';
import { BODY_PRESETS } from '../game/build/characterBases';
import { presetBuild } from '../game/build/buildPresets';
import { lookFromSetup, FighterLook } from '../game/render/fighter/fighterLook';
import { createFighterView, drawFighter, FighterView } from '../game/render/fighter/fighterView';
import { FighterState, RIG_SCALE, solvePose } from '../game/render/fighter/fighterPose';
import { gripPoints } from '../game/render/fighter/weaponGrips';
import { IDLE_PARTS } from '../game/render/fighter/parts/partMotionFrame';
import { BODY_ART, KIT_ART } from '../game/render/characters/definitions';
import { RUNTIME_BODY_ART } from '../game/render/characters/runtimeDefinitions';
import { ArtRig, createArtRig, updateArtRig } from '../game/render/characters/rigView';
import type { RigTargets } from '../game/render/characters/rigTargets';
import { bodyAtlasTexture, bodyTexture } from '../game/render/characters/textures';

/** The armed-only 3D-kit hand poses; the source assembly shows open hands. */
const GRIP_POSE = /^palm|Grip$/;

export const RIG_GROUND = 200;
export const RIG_WIDTH = 1400;
export const RIG_HEIGHT = 650;
export const RIG_ZOOM = 2.6;
export interface DemoActor { root: Container; live: FighterView; source: ArtRig; sourceRoot: Container; look: FighterLook; x: number }

export const createDemoActors = (world: Container, humanOnly = false, zoom = RIG_ZOOM): DemoActor[] => {
    const presets = humanOnly ? BODY_PRESETS.filter(p => p.body === 'human') : BODY_PRESETS;
    return presets.map((preset, index) => {
    // A 3D kit draws from its atlas definition; joints still come from its frame-pixel anatomy
    const kit = !!KIT_ART[preset.body];
    const definition = BODY_ART[preset.body], texture = bodyTexture(preset.body);
    const drawn = kit ? RUNTIME_BODY_ART[preset.body] : definition;
    if (!texture) throw new Error(`Character ${preset.body} is not loaded for inspection`);
    const look = lookFromSetup(preset.palette, presetBuild(preset.id));
    const atlas = kit ? bodyAtlasTexture(preset.body) : undefined;
    if (kit && !atlas) throw new Error(`Character ${preset.body} atlas is not loaded for inspection`);
    const root = new Container(), live = createFighterView(), source = createArtRig(drawn, texture, atlas), sourceRoot = new Container();
    const x = (index + 0.5) * RIG_WIDTH / zoom / presets.length;
    root.position.set(x, 0);
    sourceRoot.addChild(source.tail, source.back, source.body, source.head, source.under, source.front);
    sourceRoot.scale.set(RIG_SCALE);
    root.addChild(sourceRoot, live.root);
    world.addChild(root);
    const targets: RigTargets = {};
    const at = (p: readonly [number, number]) => ({ x: (p[0] - definition.hip[0]) * source.scale,
        y: (p[1] - definition.hip[1]) * source.scale });
    for (const [id, part] of Object.entries(definition.parts)) {
        if (GRIP_POSE.test(id)) continue;
        targets[id as keyof RigTargets] = { start: at(part.origin), end: part.axisEnd ? at(part.axisEnd) : undefined };
    }
    updateArtRig(source, targets, look);
    const bottom = Math.max(...['footFront', 'footBack'].flatMap(id =>
        definition.parts[id as 'footFront' | 'footBack']?.polygon.map(p => p[1]) ?? []));
    sourceRoot.position.y = RIG_GROUND - (bottom - definition.hip[1]) * source.scale * RIG_SCALE;
    return { root, live, source, sourceRoot, look, x };
    });
};

export const drawDemoActor = (actor: DemoActor, mode: string, time: number, facing: 1 | -1,
    textures: Record<string, Texture>, wounded = false): void => {
    actor.sourceRoot.visible = mode === 'source';
    actor.sourceRoot.scale.x = facing * RIG_SCALE;
    actor.live.root.visible = mode !== 'source';
    if (mode === 'source') return;
    const jump = mode === 'jump' ? Math.max(0, Math.sin(time * 2.3)) * 45 : 0;
    const state: FighterState = mode === 'jump' ? (Math.cos(time * 2.3) > 0 ? 'fly' : 'fall')
        : ['idle', 'run', 'fly', 'crouch', 'prone'].includes(mode) ? mode as FighterState : 'idle';
    const weapon = textures.held_machine_gun;
    const grip = gripPoints(WeaponType.MACHINE_GUN, weapon ? weapon.height / weapon.width : 0.23);
    actor.live.root.position.set(0, RIG_GROUND - jump - (mode === 'fly' ? 28 + Math.sin(time * 2) * 3 : 0));
    drawFighter(actor.live, {
        pose: solvePose({ state, aim: Math.sin(time * 0.8) * 0.25, t: time, phase: time * 7, moveDir: 1,
            recoil: 0, grip, body: actor.look.build.body }),
        look: actor.look, facing, grip, weapon, weaponType: WeaponType.MACHINE_GUN,
        flame: mode === 'fly', flicker: 0.6, parts: { ...IDLE_PARTS, tailWave: time, tailLift: state === 'fly' ? 1 : 0 },
        muzzleFlash: 0, oneLeg: wounded, expression: mode === 'hurt' ? 'hurt' : 'normal',
    });
};
