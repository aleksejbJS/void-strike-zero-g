// Only illustrated cosmetic corpses need painted thickness; legacy point physics stays unchanged.
import { isBodyId, type BodyId } from '../../build/bodyTypes';
import { BODY_ART } from '../../render/characters/definitions';
import { artScale } from '../../render/characters/placement';
import { RIG_SCALE } from '../../render/fighter/fighterPose';
import type { Corpse, CorpsePointId } from './corpseBody';

type Radii = Readonly<Record<CorpsePointId, number>>;
const JOINT_RADII: Radii = { hip: 5, neck: 5.5, head: 0, shF: 3.5, shB: 3.5,
    elF: 3, elB: 3, haF: 2.75, haB: 2.75, knF: 3.25, knB: 3.25, anF: 3, anB: 3, gunA: 0, gunB: 0 };
const cached = new Map<BodyId, Radii>();

export const corpseContactRadii = (c: Corpse): Radii | undefined => {
    const id = c.colors?.build?.body;
    if (!isBodyId(id)) return undefined;
    let radii = cached.get(id);
    if (!radii) {
        const definition = BODY_ART[id], head = definition.parts.head;
        if (!head) throw new Error(`Character ${id} has no head contact outline`);
        const headRadius = Math.max(...head.polygon.map(([x, y]) => Math.hypot(x - head.origin[0], y - head.origin[1]))) * artScale(definition);
        radii = Object.fromEntries(Object.entries(JOINT_RADII).map(([key, radius]) =>
            [key, (key === 'head' ? headRadius : radius) * RIG_SCALE])) as Record<CorpsePointId, number>;
        cached.set(id, radii);
    }
    return radii;
};
