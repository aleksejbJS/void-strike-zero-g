// Pixi filter quad conventions follow the installed AlphaFilter GL/WGSL templates.
// Classify original unpremultiplied pixels, then tint only non-blood premultiplied RGB.
export const BLOOD_RED_RATIO = 2.2;
export const BLOOD_RED_SOFTNESS = 0.08;

export const BLOOD_TINT_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
    vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    p.x = p.x * (2.0 / uOutputTexture.x) - 1.0;
    p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(p, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

export const BLOOD_TINT_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uHeadTint;
void main() {
    vec4 pixel = texture(uTexture, vTextureCoord);
    vec3 original = pixel.rgb / max(pixel.a, 0.000001);
    float blood = smoothstep(0.0, ${BLOOD_RED_SOFTNESS}, original.r - ${BLOOD_RED_RATIO} * max(original.g, original.b));
    finalColor = vec4(mix(pixel.rgb * uHeadTint.rgb, pixel.rgb, blood), pixel.a);
}`;

export const BLOOD_TINT_WGSL = `
struct GlobalFilterUniforms {
    uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
    uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
struct HeadTintUniforms { uHeadTint: vec4<f32>, };
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> headTintUniforms: HeadTintUniforms;
struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};
@vertex
fn mainVertex(
    @location(0) aPosition: vec2<f32>,
) -> VSOutput {
    var p = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    p.x = p.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    p.y = p.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4<f32>(p, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let pixel = textureSample(uTexture, uSampler, uv);
    let original = pixel.rgb / max(pixel.a, 0.000001);
    let blood = smoothstep(0.0, ${BLOOD_RED_SOFTNESS}, original.r - ${BLOOD_RED_RATIO} * max(original.g, original.b));
    return vec4<f32>(mix(pixel.rgb * headTintUniforms.uHeadTint.rgb, pixel.rgb, vec3<f32>(blood)), pixel.a);
}`;
