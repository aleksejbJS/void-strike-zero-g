// Where a torn robot shows open sockets, in rig space: on the body that lost a part and on the part itself.
// A socket points out of the wound, along the missing part, so its cables hang the way the part hung.
import type { Vector2 } from '../../../types';
import type { Corpse } from '../../systems/ragdoll/corpseBody';
import { upperPoint, type FighterPose } from '../fighter/fighterPose';
import { piecesOf } from '../ragdoll/corpsePose';
import type { ArtTarget } from './placement';
import type { BodyArtDefinition, XY } from './artTypes';
import type { RigTargets } from './rigTargets';
import { sourceBodyPoint } from './bodyPose';

export type SocketKind = 'neck' | 'shoulder' | 'hip' | 'waist';
export interface Socket { at: Vector2; dir: Vector2; radius: number; kind: SocketKind }

/** Rig units: the flange's own radius (0.075 m at 19 rig units per 0.6 m) times its size per joint. */
const FLANGE_RADIUS = 2.375;
const SIZE: Record<SocketKind, number> = { neck: 1.0, shoulder: 0.8, hip: 0.9, waist: 1.3 };
/** Rig units from the thigh joint down to the lower edge of the robot's shorts. */
const SHORTS_EDGE = 3;

const unit = (v: Vector2): Vector2 => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const minus = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const lerp = (a: Vector2, b: Vector2, t: number): Vector2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const socket = (kind: SocketKind, at: Vector2, dir: Vector2): Socket => ({ kind, at, dir: unit(dir), radius: FLANGE_RADIUS * SIZE[kind] });
/** Out of a bone's start, away from its end (an arm or a leg torn at its root). */
const fromRoot = (kind: SocketKind, bone: ArtTarget): Socket => socket(kind, bone.start, minus(bone.start, bone.end!));

/** A live (or whole fallen) robot that lost its back leg: the open back hip, pointing down the body. */
export const liveSockets = (definition: BodyArtDefinition, pose: FighterPose, oneLeg: boolean): Socket[] => {
    if (!oneLeg) return [];
    const anatomy = definition.anatomy ?? definition, thigh = anatomy.parts.thighBack;
    const hip = sourceBodyPoint(anatomy, pose, thigh?.origin ?? anatomy.hip);
    // The thigh joint sits inside the shorts: show the torn flange at their lower edge instead
    const down = socket('hip', hip, minus(pose.hip, upperPoint(pose, 0, -19)));
    return [{ ...down, at: { x: hip.x + down.dir.x * SHORTS_EDGE, y: hip.y + down.dir.y * SHORTS_EDGE } }];
};

/** The body frame a torso target describes: hip at its start, leaning along it. */
const torsoFrame = (torso: ArtTarget): Pick<FighterPose, 'hip' | 'lean' | 'lift'> => {
    const up = minus(torso.end!, torso.start);
    return { hip: torso.start, lean: Math.atan2(up.x, -up.y), lift: 0 };
};

/** Every open socket of a torn robot corpse (gib, cut or a torn-off leg); none for a whole body. */
export const corpseSockets = (definition: BodyArtDefinition, c: Corpse, targets: RigTargets): Socket[] => {
    const anatomy = definition.anatomy ?? definition;
    const sockets: Socket[] = [];
    for (const piece of piecesOf(c)) {
        const t = targets;
        if (piece.part === 'torso' && t.torso?.end) {
            const frame = torsoFrame(t.torso) as FighterPose, down = minus(t.torso.start, t.torso.end);
            const at = (point: XY | undefined, fallback: XY) => sourceBodyPoint(anatomy, frame, point ?? fallback);
            sockets.push(socket('neck', t.torso.end, minus(t.torso.end, t.torso.start)));
            for (const side of ['Front', 'Back'] as const) {
                sockets.push(socket('shoulder', at(anatomy.parts[`upperArm${side}`]?.origin, anatomy.neck), down));
                sockets.push(socket('hip', at(anatomy.parts[`thigh${side}`]?.origin, anatomy.hip), down));
            }
        } else if (piece.part === 'head' && t.head) {
            const r = t.head.rotation ?? 0;
            sockets.push(socket('neck', t.head.start, { x: -Math.sin(r), y: Math.cos(r) }));
        } else if (piece.part === 'arm-front' && t.upperArmFront?.end) sockets.push(fromRoot('shoulder', t.upperArmFront));
        else if (piece.part === 'arm-back' && t.upperArmBack?.end) sockets.push(fromRoot('shoulder', t.upperArmBack));
        else if (piece.part === 'leg-front' && t.thighFront?.end) sockets.push(fromRoot('hip', t.thighFront));
        else if (piece.part === 'leg-back' && t.thighBack?.end) sockets.push(fromRoot('hip', t.thighBack));
        else if (piece.part === 'upper' && t.torso?.end) {
            sockets.push(socket('waist', lerp(t.torso.start, t.torso.end, 0.5), minus(t.torso.start, t.torso.end)));
        } else if (piece.part === 'legs' && t.pelvis?.end) {
            sockets.push(socket('waist', lerp(t.pelvis.start, t.pelvis.end, 0.5), minus(t.pelvis.end, t.pelvis.start)));
        }
    }
    return sockets;
};
