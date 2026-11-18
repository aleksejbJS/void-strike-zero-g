// Painted Human blood stays on severed surfaces; meshes own geometry and share the damage picture.
import { Container, Mesh, MeshGeometry, type Texture } from 'pixi.js';
import type { Vector2 } from '../../../types';
import type { Corpse } from '../../systems/ragdoll/corpseBody';
import type { FighterPose } from '../fighter/fighterPose';
import { poseFromCorpse } from '../ragdoll/corpsePose';
import type { BodyArtDefinition, SourcePart } from './artTypes';
import { sourceBodyPoint } from './bodyPose';
import { HUMAN_WOUNDS } from './data/humanPoseVariants';
import { artScale, partGeometry, placePart, type ArtTarget } from './placement';
import type { RigTargets } from './rigTargets';

const CAP_TYPES = { headNeck: 'neck', torsoNeck: 'neck', armFront: 'arm', armBack: 'arm', legFront: 'leg', legBack: 'leg',
    shoulderFront: 'arm', shoulderBack: 'arm', hipFront: 'leg', hipBack: 'leg', waistUpper: 'waist', waistLower: 'waist' } as const;
// The V2 Human shirt hem and pelvis top meet about five rig units above the hip.
const HUMAN_CUT_HEIGHT = 5;
export type HumanCapId = keyof typeof CAP_TYPES;
export type HumanWoundTargets = Partial<Record<HumanCapId, ArtTarget>>;
export interface HumanWounds {
    root: Container; scale: number;
    meshes: Partial<Record<HumanCapId, Mesh>>;
    sources: Partial<Record<HumanCapId, SourcePart>>;
}

export const createHumanWounds = (definition: BodyArtDefinition, resolveImage: (path: string) => Texture | undefined,
    caps = Object.keys(CAP_TYPES) as HumanCapId[]): HumanWounds | undefined => {
    if (definition.id !== 'human') return undefined;
    const wounds: HumanWounds = { root: new Container(), scale: artScale(definition), meshes: {}, sources: {} };
    wounds.root.label = 'human-wounds';
    for (const id of caps) {
        const source = HUMAN_WOUNDS[CAP_TYPES[id]], image = source?.image;
        const texture = image && resolveImage(image.imagePath);
        if (!source || !image || !texture || texture.destroyed) continue;
        let geometry: MeshGeometry | undefined;
        try {
            geometry = new MeshGeometry(partGeometry(source, image.size));
            const mesh = new Mesh({ geometry, texture }), ownedGeometry = geometry;
            mesh.label = `human-wound-${id}`;
            mesh.visible = false;
            mesh.on('destroyed', () => ownedGeometry.destroy(true));
            wounds.meshes[id] = mesh; wounds.sources[id] = source; wounds.root.addChild(mesh);
        } catch (error) {
            geometry?.destroy(true);
            console.warn(`Human wound "${id}" could not be drawn; keeping the existing body artwork:`, error);
        }
    }
    if (wounds.root.children.length) return wounds;
    wounds.root.destroy(); return undefined;
};

export const updateHumanWounds = (wounds: HumanWounds, targets: HumanWoundTargets): void => {
    for (const id of Object.keys(wounds.meshes) as HumanCapId[]) {
        const mesh = wounds.meshes[id]!, source = wounds.sources[id]!, target = targets[id];
        mesh.visible = !!target && target.visible !== false;
        if (!target) continue;
        const at = placePart(source, target, wounds.scale);
        mesh.position.set(at.x, at.y); mesh.rotation = at.rotation; mesh.scale.set(at.scaleX, at.scaleY);
        mesh.visible = at.visible; mesh.tint = 0xffffff;
    }
};

export const destroyHumanWounds = (wounds: HumanWounds): void => {
    if (!wounds.root.destroyed) wounds.root.destroy({ children: true });
};

const angle = (a: Vector2, b: Vector2) => Math.atan2(b.y - a.y, b.x - a.x);
/** Caps are authored across a horizontal section, with the remaining part extending along local +Y. */
const section = (bone: ArtTarget, fraction = 0, reverse = false): ArtTarget => {
    const end = bone.end ?? bone.start;
    return { start: { x: bone.start.x + (end.x - bone.start.x) * fraction, y: bone.start.y + (end.y - bone.start.y) * fraction },
        rotation: angle(bone.start, end) - Math.PI / 2 + (reverse ? Math.PI : 0), visible: bone.visible };
};

const socket = (definition: BodyArtDefinition, pose: FighterPose, part: SourcePart | undefined): ArtTarget | undefined => {
    if (!part) return undefined;
    const start = sourceBodyPoint(definition, pose, part.origin);
    const end = sourceBodyPoint(definition, pose, part.axisEnd ?? definition.neck);
    return section({ start, end }, 0, true);
};

export const humanLiveWoundTargets = (definition: BodyArtDefinition, pose: FighterPose, oneLeg: boolean): HumanWoundTargets => {
    if (definition.id !== 'human' || !oneLeg) return {};
    const anatomy = definition.anatomy ?? definition;
    return { hipBack: socket(anatomy, pose, anatomy.parts.thighBack) };
};

export const humanCorpseWoundTargets = (definition: BodyArtDefinition, c: Corpse, targets: RigTargets): HumanWoundTargets => {
    if (definition.id !== 'human') return {};
    const out: HumanWoundTargets = {}, anatomy = definition.anatomy ?? definition, { pose } = poseFromCorpse(c);
    if (c.kind === 'gib') {
        for (const side of ['Front', 'Back'] as const) {
            const arm = targets[`upperArm${side}`], leg = targets[`thigh${side}`];
            if (arm) out[`arm${side}`] = section(arm);
            if (leg) out[`leg${side}`] = section(leg);
        }
        const head = targets.head, originalHead = anatomy.parts.head;
        if (head && originalHead) {
            const turn = head.rotation ?? 0, scale = artScale(anatomy);
            const dx = (anatomy.neck[0] - originalHead.origin[0]) * scale, dy = (anatomy.neck[1] - originalHead.origin[1]) * scale;
            out.headNeck = { start: { x: head.start.x + dx * Math.cos(turn) - dy * Math.sin(turn),
                y: head.start.y + dx * Math.sin(turn) + dy * Math.cos(turn) }, rotation: turn + Math.PI };
        }
        const torso = targets.torso;
        if (torso) {
            out.torsoNeck = section(torso, 1, true);
            const frame = { ...pose, hip: torso.start, lean: angle(torso.start, torso.end!) + Math.PI / 2,
                lift: Math.hypot(torso.end!.x - torso.start.x, torso.end!.y - torso.start.y) - 19 };
            for (const side of ['Front', 'Back'] as const) {
                out[`shoulder${side}`] = socket(anatomy, frame, anatomy.parts[`upperArm${side}`]);
                out[`hip${side}`] = socket(anatomy, frame, anatomy.parts[`thigh${side}`]);
            }
        }
    } else if (c.kind === 'cut') {
        if (targets.torso) out.waistUpper = section(targets.torso, HUMAN_CUT_HEIGHT / 19);
        if (targets.pelvis) {
            out.waistLower = section(targets.pelvis, HUMAN_CUT_HEIGHT / 19, true);
            if (c.oneLeg) {
                const bone = targets.pelvis;
                const frame = { ...pose, hip: bone.start, lean: angle(bone.start, bone.end!) + Math.PI / 2 };
                out.hipBack = socket(anatomy, frame, anatomy.parts.thighBack);
            }
        }
    }
    return out;
};
