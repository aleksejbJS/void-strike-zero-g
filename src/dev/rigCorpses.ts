// Ragdoll inspection uses the game's real corpse creation, launch, solver and view.
import { Container, Texture } from 'pixi.js';
import { WeaponType, Platform } from '../types';
import { Corpse, createCorpse } from '../game/systems/ragdoll/corpseBody';
import { launchCorpse, launchLimb } from '../game/systems/ragdoll/corpseLaunch';
import { stepCorpse } from '../game/systems/ragdoll/corpseStep';
import { CorpseView, createCorpseView, destroyCorpseView, updateCorpseView } from '../game/render/ragdoll/corpseView';
import type { DemoActor } from './rigActors';
import { RIG_GROUND } from './rigActors';

export interface DemoCorpse { data: Corpse; view: CorpseView }
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export const createDemoCorpses = (actors: DemoActor[], mode: string, facing: 1 | -1,
    world: Container, textures: Record<string, Texture>): DemoCorpse[] => actors.map(actor => {
    const look = actor.look;
    const data = createCorpse({ x: actor.x, y: RIG_GROUND, facing,
        kind: mode === 'fall-body' ? 'fall' : mode === 'cut' ? 'cut' : 'gib',
        weapon: mode === 'limb' ? undefined : WeaponType.MACHINE_GUN,
        parts: { head: hex(look.head), torso: hex(look.torso), arm: hex(look.arm), leg: hex(look.leg), build: look.build } });
    const from = { x: actor.x + facing * 15, y: RIG_GROUND - 35 };
    if (mode === 'limb') { data.only = 'leg-back'; launchLimb(data, from, { x: 0, y: 0 }); }
    else launchCorpse(data, from, { x: 0, y: 0 });
    const view = createCorpseView(data, textures);
    world.addChild(view.root);
    return { data, view };
});

export const stepDemoCorpses = (corpses: DemoCorpse[], ground: Platform[]): void => {
    for (const corpse of corpses) {
        stepCorpse(corpse.data, ground);
        updateCorpseView(corpse.view, corpse.data);
    }
};

export const clearDemoCorpses = (corpses: DemoCorpse[]): void => {
    for (const corpse of corpses) destroyCorpseView(corpse.view);
    corpses.length = 0;
};
