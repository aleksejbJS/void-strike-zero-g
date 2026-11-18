// One quad per smoke cloud: a mesh over the air grid's box, a small RGBA8 texture filled from the grid
// (r = density, g = heat, b = soot) and the CFD-look shader. Owns its Mesh, Shader, Texture (with source)
// and geometry; destroy() frees all four, whether the stage destroyed the mesh before or not. Visual only.

import { BufferImageSource, Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import type { AirGrid } from './airGrid';
import { SMOKE_FRAGMENT, SMOKE_VERTEX } from './smokeShader';
import { FIELD_RANGE, SMOKE_SOOT } from './smokeTuning';

type Colour = readonly [number, number, number];
type Uniforms = { uTime: number; uFade: number };

const BYTE_PER_UNIT = 255 / FIELD_RANGE;

/** Round `x` into a byte, clamped to 0..255 (NaN gives 0). The +0.5 is rounded off by the Uint8Array store. */
const toByte = (x: number): number => (x > 0 ? (x < 255 ? x + 0.5 : 255) : 0);

export class SmokeQuad {
    readonly mesh: Mesh<MeshGeometry, Shader>;
    readonly texture: Texture;
    private readonly shader: Shader;            // kept here: a destroyed mesh forgets its shader and geometry
    private readonly geometry: MeshGeometry;
    private readonly grid: AirGrid;
    private readonly bytes: Uint8Array;
    private readonly source: BufferImageSource;
    private readonly uniforms: Uniforms;
    private destroyed = false;

    /** `colour` is the base aerosol colour (linear RGB, 0..1); soot darkens it toward SMOKE_SOOT. */
    constructor(grid: AirGrid, colour: Colour) {
        this.grid = grid;
        const { n, x0, y0, size } = grid;
        this.bytes = new Uint8Array(n * n * 4);
        this.source = new BufferImageSource({ resource: this.bytes, width: n, height: n, format: 'rgba8unorm', scaleMode: 'linear' });
        this.texture = new Texture({ source: this.source });
        const shader = this.shader = Shader.from({
            gl: { vertex: SMOKE_VERTEX, fragment: SMOKE_FRAGMENT, name: 'smoke-cloud-sim' },
            resources: {
                uField: this.source,
                uFieldSampler: this.source.style,
                smokeUniforms: {
                    uTexel: { value: new Float32Array([1 / n, 1 / n]), type: 'vec2<f32>' },
                    uTime: { value: 0, type: 'f32' },
                    uFade: { value: 1, type: 'f32' },
                    uSmokeColor: { value: new Float32Array(colour), type: 'vec3<f32>' },
                    uSootColor: { value: new Float32Array(SMOKE_SOOT), type: 'vec3<f32>' },
                },
            },
        });
        // Vertices are the grid box in world pixels (the mesh sits at the origin): the shader's noise is anchored to the world
        const geometry = this.geometry = new MeshGeometry({
            positions: new Float32Array([x0, y0, x0 + size, y0, x0 + size, y0 + size, x0, y0 + size]),
            uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        });
        this.mesh = new Mesh({ geometry, shader });
        this.uniforms = shader.resources.smokeUniforms.uniforms as Uniforms;
    }

    /** Copy the grid into the texture and set the frame's uniforms. `time` is seconds (keep it small, e.g. modulo
     *  a million ms, for float precision); `fade` 0..1 multiplies the cloud's alpha. */
    upload(time: number, fade: number): void {
        if (this.destroyed) return;
        const { d, t, s } = this.grid;
        const b = this.bytes;
        for (let k = 0, o = 0; k < d.length; k++, o += 4) {
            b[o] = toByte(d[k] * BYTE_PER_UNIT);
            b[o + 1] = toByte(t[k] * BYTE_PER_UNIT);
            b[o + 2] = toByte(s[k] * 255);
            b[o + 3] = 255;
        }
        this.source.update();
        this.uniforms.uTime = time;
        this.uniforms.uFade = fade > 0 ? Math.min(1, fade) : 0;
    }

    /** Remove the mesh from its parent and free mesh, shader, texture (with source) and geometry. Safe to call twice, and
     *  after the mesh was destroyed with the stage (destroyApp does that; Pixi then drops the mesh's shader and geometry
     *  without freeing them, so they are freed here from the fields). */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        const { mesh, shader, geometry } = this;
        mesh.parent?.removeChild(mesh);
        if (!mesh.destroyed) mesh.destroy();
        shader.destroy();                                  // does nothing when it is already destroyed
        if (geometry.attributes !== null) geometry.destroy(true);
        this.texture.destroy(true);
    }
}
