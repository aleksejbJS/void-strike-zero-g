// One reusable head filter per rig; programs are shared, uniforms belong to this instance.
import { Filter, GlProgram, GpuProgram, UniformGroup } from 'pixi.js';
import { BLOOD_TINT_FRAGMENT, BLOOD_TINT_VERTEX, BLOOD_TINT_WGSL } from './bloodTintShaders';

export class BloodTintFilter extends Filter {
    private color = 0xffffff;
    private readonly components: Float32Array;

    constructor() {
        const components = new Float32Array([1, 1, 1, 1]);
        super({
            glProgram: GlProgram.from({ vertex: BLOOD_TINT_VERTEX, fragment: BLOOD_TINT_FRAGMENT, name: 'blood-preserving-head-tint' }),
            gpuProgram: GpuProgram.from({ vertex: { source: BLOOD_TINT_WGSL, entryPoint: 'mainVertex' },
                fragment: { source: BLOOD_TINT_WGSL, entryPoint: 'mainFragment' } }),
            resources: { headTintUniforms: new UniformGroup({ uHeadTint: { value: components, type: 'vec4<f32>' } }) },
        });
        this.components = components;
    }

    get headTint(): number { return this.color; }
    set headTint(value: number) {
        if (this.color === value) return;
        this.color = value;
        this.components[0] = ((value >> 16) & 255) / 255;
        this.components[1] = ((value >> 8) & 255) / 255;
        this.components[2] = (value & 255) / 255;
        this.resources.headTintUniforms.update();
    }
}
