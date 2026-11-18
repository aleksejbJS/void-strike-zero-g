import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Mesh, Texture } from 'pixi.js';
import { BODY_ART } from './definitions';
import { createArtRig, destroyArtRig } from './rigView';
import type { BodyArtDefinition, SourcePart } from './artTypes';

afterEach(() => { vi.restoreAllMocks(); });

describe('illustrated rig ownership', () => {
    it('uses a part image override before the body atlas, including the image-specific UV size', () => {
        const image = new Texture({ source: Texture.WHITE.source });
        const head = { polygon: [[100, 50], [120, 50], [100, 70]], origin: [100, 50], channel: 'head',
            texture: 'atlas', image: { imagePath: '/human-dead.png', size: [200, 100] } } as SourcePart;
        const definition = { ...BODY_ART.human, parts: { head } };
        const rig = createArtRig(definition, Texture.WHITE, undefined, path => path === '/human-dead.png' ? image : undefined);
        expect(rig.meshes.head!.texture).toBe(image);
        expect(rig.meshes.head!.geometry.uvs[0]).toBeCloseTo(0.5);
        expect(rig.meshes.head!.geometry.uvs[1]).toBeCloseTo(0.5);
        const buffers = [...rig.meshes.head!.geometry.buffers];
        destroyArtRig(rig);
        expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect(image.destroyed).toBe(false); image.destroy();
    });

    it('rejects a missing declared part image explicitly so a selector can retain its previous appearance', () => {
        const definition: BodyArtDefinition = { ...BODY_ART.human, parts: { head: { ...BODY_ART.human.parts.head!,
            image: { imagePath: '/missing-head.png', size: [200, 100] } } } };
        expect(() => createArtRig(definition, Texture.WHITE, undefined, () => undefined)).toThrow('/missing-head.png');
    });

    it('maps original head pixels and atlas body pixels through their own texture sizes', () => {
        const head: SourcePart = { polygon: [[0, 0], [10, 0], [0, 10]], origin: [0, 0], channel: 'head' };
        const torso = { polygon: [[100, 50], [120, 50], [100, 70]], origin: [100, 50],
            axisEnd: [100, 70], channel: 'torso', texture: 'atlas', pixelScale: 0.2 } as SourcePart;
        const definition = { ...BODY_ART.human, size: [100, 100], atlas: { imagePath: '/atlas.png', size: [200, 100] },
            parts: { head, torso } } as BodyArtDefinition;
        const original = new Texture({ source: Texture.WHITE.source });
        const atlas = new Texture({ source: Texture.WHITE.source });
        const rig = createArtRig(definition, original, atlas);
        expect(rig.meshes.head!.texture).toBe(original);
        expect(rig.meshes.torso!.texture).toBe(atlas);
        expect(rig.meshes.head!.geometry.uvs[2]).toBeCloseTo(0.1);
        expect(rig.meshes.torso!.geometry.uvs[0]).toBeCloseTo(0.5);
        expect(rig.meshes.torso!.geometry.uvs[1]).toBeCloseTo(0.5);
        destroyArtRig(rig);
        expect(original.destroyed).toBe(false); expect(atlas.destroyed).toBe(false);
        original.destroy(); atlas.destroy();
    });

    it('rejects an atlas-backed definition without its atlas instead of sampling the original image', () => {
        const definition = { ...BODY_ART.human, parts: { ...BODY_ART.human.parts,
            torso: { ...BODY_ART.human.parts.torso!, texture: 'atlas' } } } as BodyArtDefinition;
        expect(() => createArtRig(definition, Texture.WHITE)).toThrow('atlas');
    });

    it('releases meshes and their GPU buffers without destroying the shared picture', () => {
        const texture = new Texture({ source: Texture.WHITE.source });
        const rig = createArtRig(BODY_ART.human, texture);
        const meshes = Object.values(rig.meshes);
        const buffers = meshes.flatMap(mesh => [...mesh.geometry.buffers]);
        destroyArtRig(rig);
        expect(meshes).toHaveLength(15);
        expect(meshes.every(mesh => mesh.destroyed)).toBe(true);
        expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect([rig.tail, rig.back, rig.body, rig.head, rig.front, rig.overlay].every(group => group.destroyed)).toBe(true);
        expect(texture.destroyed).toBe(false);
        expect(() => destroyArtRig(rig)).not.toThrow();
        texture.destroy();
    });

    it('cleans a partially built rig when a later source polygon fails to triangulate', () => {
        const texture = new Texture({ source: Texture.WHITE.source });
        const created: { mesh: Mesh; buffers: Mesh['geometry']['buffers']; parent: Container }[] = [];
        const addChild = Container.prototype.addChild;
        vi.spyOn(Container.prototype, 'addChild').mockImplementation(function <T extends Container[]>(this: Container, ...children: T): T[0] {
            for (const child of children) if (child instanceof Mesh) {
                created.push({ mesh: child, buffers: [...child.geometry.buffers], parent: this });
            }
            return addChild.apply(this, children) as T[0];
        });
        const invalid = {
            ...BODY_ART.human,
            parts: { ...BODY_ART.human.parts, head: { ...BODY_ART.human.parts.head!, polygon: [[0, 0], [1, 1], [2, 2]] as const } },
        };
        try {
            expect(() => createArtRig(invalid, texture)).toThrow('Character cutout has zero area');
            expect(created).toHaveLength(10);
            expect(created.every(({ mesh }) => mesh.destroyed)).toBe(true);
            expect(created.flatMap(({ buffers }) => buffers).every(buffer => buffer.destroyed)).toBe(true);
            expect(created.every(({ parent }) => parent.destroyed)).toBe(true);
            expect(texture.destroyed).toBe(false);
        } finally {
            // Keep the test's own allocations bounded while proving the failing implementation leaks.
            for (const { mesh } of created) if (!mesh.destroyed) mesh.destroy();
            texture.destroy();
        }
    });
});
