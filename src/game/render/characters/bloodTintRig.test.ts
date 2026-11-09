import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { BODY_PALETTES, BODY_PRESETS } from '../../build/characterBases';
import { presetBuild } from '../../build/buildPresets';
import { lookFromSetup } from '../fighter/fighterLook';
import { BODY_ART } from './definitions';
import { createArtRig, destroyArtRig, updateArtRig, type ArtRig } from './rigView';
import type { BodyArtDefinition } from './artTypes';

const rigs: ArtRig[] = [];
const make = (preserveBlood = true) => {
    const definition = { ...BODY_ART.human, parts: { head: { ...BODY_ART.human.parts.head!, preserveBlood } } } as BodyArtDefinition;
    const rig = createArtRig(definition, Texture.WHITE); rigs.push(rig); return rig;
};
const look = (head: number) => ({ ...lookFromSetup(BODY_PRESETS[0].palette, presetBuild('base-human')), head });
const targets = { head: { start: { x: 0, y: 0 } } };
// jsdom cannot provide the WebGL precision probe; GPU output is checked in the browser.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { for (const rig of rigs.splice(0)) destroyArtRig(rig); vi.restoreAllMocks(); });

describe('blood-preserving head tint lifecycle', () => {
    it('passes custom head color through one filter while the mesh stays untinted', () => {
        const rig = make(), mesh = rig.meshes.head!, geometry = mesh.geometry;
        updateArtRig(rig, targets, look(0x112233));
        expect(rig.bloodTint).toBeDefined(); expect(mesh.tint).toBe(0xffffff);
        const filter = rig.bloodTint!, uniforms = filter.resources.headTintUniforms.uniforms.uHeadTint;
        expect(filter.headTint).toBe(0x112233);
        expect(uniforms[0]).toBeCloseTo(17 / 255); expect(uniforms[1]).toBeCloseTo(34 / 255); expect(uniforms[2]).toBeCloseTo(51 / 255);
        expect(filter.glProgram).toBeTruthy(); expect(filter.gpuProgram).toBeTruthy();
        expect(filter.gpuProgram!.attributeData.aPosition).toMatchObject({ location: 0, format: 'float32x2' });
        updateArtRig(rig, targets, look(0x336699));
        expect(rig.bloodTint).toBe(filter); expect(mesh.geometry).toBe(geometry);
        expect(filter.resources.headTintUniforms.uniforms.uHeadTint).toBe(uniforms);
        expect(filter.headTint).toBe(0x336699);
        expect(mesh.filters?.[0]).toBe(filter);
    });

    it('keeps the canonical source colors and the existing unflagged mesh tint behavior', () => {
        const rig = make(); updateArtRig(rig, targets, look(BODY_PALETTES.human.head));
        expect(rig.bloodTint).toBeUndefined(); expect(rig.meshes.head!.tint).toBe(0xffffff);
        updateArtRig(rig, targets, look(0x112233)); const filter = rig.bloodTint;
        updateArtRig(rig, targets, look(BODY_PALETTES.human.head));
        expect(rig.bloodTint).toBe(filter); expect(rig.meshes.head!.filters).toBeNull();
        const ordinary = make(false); updateArtRig(ordinary, targets, look(0x112233));
        expect(ordinary.meshes.head!.tint).toBe(0x112233); expect(ordinary.bloodTint).toBeUndefined();
    });

    it('destroys the cached filter once when its head is disposed, preserving shared textures', () => {
        const rig = make(); updateArtRig(rig, targets, look(0x112233));
        const destroy = vi.spyOn(rig.bloodTint!, 'destroy');
        rig.head.destroy({ children: true }); destroyArtRig(rig); destroyArtRig(rig);
        expect(destroy).toHaveBeenCalledTimes(1); expect(Texture.WHITE.destroyed).toBe(false);
    });
});
