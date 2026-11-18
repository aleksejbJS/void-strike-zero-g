// Each part samples the unchanged source PNG, using its own UV polygon and bone transform.
import { Container, Graphics, Mesh, MeshGeometry, Texture } from 'pixi.js';
import { BODY_PALETTES } from '../../build/characterBases';
import type { FighterLook } from '../fighter/fighterLook';
import { ART_PARTS, ArtPartId, BodyArtDefinition } from './artTypes';
import { artScale, partGeometry, placePart } from './placement';
import type { RigTargets } from './rigTargets';
import { BloodTintFilter } from './bloodTintFilter';
import { createPaintMesh, syncPaint } from './rigLayers';

export interface ArtRig {
    definition: BodyArtDefinition;
    scale: number;
    tail: Container;
    under: Container; // 3D-kit palms, drawn just under the weapon picture
    back: Container;
    body: Container;
    head: Container;
    front: Container;
    overlay: Graphics;
    meshes: Partial<Record<ArtPartId, Mesh>>;
    paint: Partial<Record<ArtPartId, Mesh>>; // 3D-kit tinted paint, one under each painted part
    bloodTint?: BloodTintFilter;
}

const GROUPS: Record<'tail' | 'back' | 'body' | 'head' | 'under' | 'front', readonly ArtPartId[]> = {
    tail: ['tail'],
    back: ['thighBack', 'shinBack', 'footBack', 'upperArmBack', 'forearmBack'],
    body: ['torso', 'thighFront', 'shinFront', 'footFront', 'pelvis'],
    head: ['head'],
    under: ['palmFront', 'palmBack'],
    front: ['handBack', 'handBackGrip', 'upperArmFront', 'forearmFront', 'handFront', 'handFrontGrip'],
};

export const createArtRig = (definition: BodyArtDefinition, texture: Texture, atlasTexture?: Texture,
    resolveImage?: (imagePath: string) => Texture | undefined): ArtRig => {
    const rig: ArtRig = { definition, scale: artScale(definition), meshes: {}, paint: {}, tail: new Container(), under: new Container(),
        back: new Container(), body: new Container(), head: new Container(), front: new Container(), overlay: new Graphics() };
    try {
        for (const group of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
            rig[group].label = `art-${group}`;
            for (const id of GROUPS[group]) {
                const source = definition.parts[id];
                if (!source) continue;
                const picture = source.image ? resolveImage?.(source.image.imagePath) : source.texture === 'atlas' ? atlasTexture : texture;
                const size = source.image?.size ?? (source.texture === 'atlas' ? definition.atlas?.size : definition.size);
                if (source.image && (!picture || picture.destroyed)) throw new Error(`Character part "${id}" requires picture "${source.image.imagePath}"`);
                if (!picture || picture.destroyed || !size) throw new Error(`Character part "${id}" requires its atlas texture and dimensions`);
                const geometry = new MeshGeometry(partGeometry(source, size));
                const mesh = new Mesh({ geometry, texture: picture });
                mesh.label = `art-${id}`;
                mesh.on('destroyed', () => geometry.destroy(true));
                rig.meshes[id] = mesh;
                const paint = createPaintMesh(source, size, picture);
                if (paint) {
                    paint.label = `art-${id}-paint`;
                    rig.paint[id] = paint;
                    rig[group].addChild(paint);
                }
                rig[group].addChild(mesh);
            }
        }
        return rig;
    } catch (error) {
        destroyArtRig(rig);
        throw error;
    }
};

export const updateArtRig = (rig: ArtRig, targets: RigTargets, look: FighterLook,
    hideHead = false, hideTail = false): void => {
    const palette = BODY_PALETTES[rig.definition.id];
    for (const id of ART_PARTS) {
        const mesh = rig.meshes[id], source = rig.definition.parts[id], target = targets[id];
        if (!mesh || !source) continue;
        mesh.visible = !!target && !(hideHead && id === 'head') && !(hideTail && id === 'tail');
        const paint = rig.paint[id];
        if (paint) paint.visible = mesh.visible;
        if (!target || !mesh.visible) continue;
        const at = placePart(source, target, rig.scale);
        mesh.visible = at.visible;
        mesh.position.set(at.x, at.y);
        mesh.rotation = at.rotation;
        mesh.scale.set(at.scaleX, at.scaleY);
        const channel = source.channel;
        const desired = channel === 'none' ? 0xffffff : look[channel];
        if (paint) {
            // Kit part: neutral paint always takes the colour, the fixed picture (metal, rust, outline) never does
            mesh.tint = 0xffffff;
            syncPaint(paint, mesh, desired);
            continue;
        }
        const custom = channel !== 'none' && desired !== palette[channel];
        if (id === 'head' && source.preserveBlood && custom) {
            if (!rig.bloodTint) {
                rig.bloodTint = new BloodTintFilter();
                mesh.once('destroyed', () => rig.bloodTint!.destroy());
            }
            rig.bloodTint.headTint = desired;
            if (mesh.filters?.[0] !== rig.bloodTint) mesh.filters = [rig.bloodTint];
            mesh.tint = 0xffffff;
        } else {
            if (id === 'head' && rig.bloodTint && mesh.filters?.length) mesh.filters = null;
            mesh.tint = custom ? desired : 0xffffff;
        }
    }
};

export const destroyArtRig = (rig: ArtRig): void => {
    for (const group of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
        if (!rig[group].destroyed) rig[group].destroy({ children: true });
    }
    if (!rig.overlay.destroyed) rig.overlay.destroy({ context: true });
};
