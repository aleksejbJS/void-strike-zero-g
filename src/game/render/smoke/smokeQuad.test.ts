import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Container, type BufferImageSource } from 'pixi.js';
import { AirGrid } from './airGrid';
import { SmokeQuad } from './smokeQuad';
import { SMOKE_WHITE } from './smokeTuning';

const makeGrid = () => new AirGrid(8, 100, 200, 160);

/** The RGBA bytes the quad uploads into its texture. */
const textureBytes = (quad: SmokeQuad) => (quad.mesh.shader!.resources.uField as BufferImageSource).resource as Uint8Array;

describe('SmokeQuad', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error. It
    // returns null either way, so answering null quietly changes nothing but the noise.
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });

    it('uploads the grid into the texture bytes', () => {
        const grid = makeGrid();
        const quad = new SmokeQuad(grid, SMOKE_WHITE);
        grid.d[0] = 1.5; grid.t[0] = 0.75; grid.s[0] = 1;   // saturated density, half heat, full soot
        grid.d[1] = 0.3; grid.t[1] = 9; grid.s[1] = 7;      // out-of-range heat and soot clamp to 255
        grid.d[2] = -0.2; grid.t[2] = -1; grid.s[2] = -1;   // negative values clamp to 0
        quad.upload(1, 1);
        const b = textureBytes(quad);
        expect(b.length).toBe(grid.n * grid.n * 4);
        expect([b[0], b[1], b[2], b[3]]).toEqual([255, 128, 255, 255]);
        expect([b[4], b[5], b[6], b[7]]).toEqual([51, 255, 255, 255]);
        expect([b[8], b[9], b[10], b[11]]).toEqual([0, 0, 0, 255]);
        // An empty cell stays opaque in the alpha byte so the shader reads density from r only
        expect([b[12], b[13], b[14], b[15]]).toEqual([0, 0, 0, 255]);
        quad.destroy();
    });

    it('covers the grid box in world pixels and keeps the mesh at the origin', () => {
        const grid = makeGrid();
        const quad = new SmokeQuad(grid, SMOKE_WHITE);
        expect([quad.mesh.x, quad.mesh.y]).toEqual([0, 0]);
        expect(Array.from(quad.mesh.geometry.positions)).toEqual([100, 200, 260, 200, 260, 360, 100, 360]);
        expect(Array.from(quad.mesh.geometry.uvs)).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
        quad.destroy();
    });

    it('hands time, fade and colour to the shader', () => {
        const quad = new SmokeQuad(makeGrid(), [0.5, 0.25, 0.125]);
        quad.upload(3.5, 0.4);
        const u = quad.mesh.shader!.resources.smokeUniforms.uniforms as { uTime: number; uFade: number; uSmokeColor: Float32Array };
        expect(u.uTime).toBe(3.5);
        expect(u.uFade).toBeCloseTo(0.4, 6);
        expect(Array.from(u.uSmokeColor)).toEqual([0.5, 0.25, 0.125]);
        quad.upload(4, 7);  // fade is clamped into 0..1
        expect(u.uFade).toBe(1);
        quad.destroy();
    });

    it('destroy frees mesh, shader and texture', () => {
        const parent = new Container();
        const quad = new SmokeQuad(makeGrid(), SMOKE_WHITE);
        parent.addChild(quad.mesh);
        const { mesh, texture } = quad;
        const shader = mesh.shader!;
        const source = texture.source;
        const geometry = mesh.geometry;
        quad.destroy();
        expect(mesh.destroyed).toBe(true);
        expect(shader._destroyed).toBe(true);
        expect(texture.destroyed).toBe(true);
        expect(source.destroyed).toBe(true);
        expect(geometry.attributes).toBeNull();   // Pixi clears a geometry's attributes when it is destroyed
        expect(mesh.parent).toBeNull();
        expect(parent.children).toHaveLength(0);
    });

    it('destroy still frees shader, geometry and texture when the stage destroyed the mesh first, as destroyApp does', () => {
        const stage = new Container();
        const quad = new SmokeQuad(makeGrid(), SMOKE_WHITE);
        stage.addChild(quad.mesh);
        const { mesh, texture } = quad;
        const shader = mesh.shader!, geometry = mesh.geometry, source = texture.source;
        stage.destroy({ children: true, texture: false });
        expect(mesh.destroyed).toBe(true);
        expect(mesh.shader).toBeNull();                      // Pixi forgot the shader and geometry without freeing them
        expect(() => quad.destroy()).not.toThrow();
        expect(shader._destroyed).toBe(true);
        expect(geometry.attributes).toBeNull();
        expect(texture.destroyed).toBe(true);
        expect(source.destroyed).toBe(true);
        expect(() => quad.destroy()).not.toThrow();
        expect(() => quad.upload(1, 1)).not.toThrow();
    });

    it('destroy is safe to call twice and upload after destroy does nothing', () => {
        const quad = new SmokeQuad(makeGrid(), SMOKE_WHITE);
        quad.destroy();
        expect(() => quad.destroy()).not.toThrow();
        expect(() => quad.upload(1, 1)).not.toThrow();
    });
});
