// GLSL that draws one cloud's air grid the way the owner's CFD demo draws its grid: noise (fbm) pushed by
// the flow makes the billows, the density slope lights the top and shades the bottom, heat glows orange,
// soot darkens. The grid comes in as a texture: r = density / FIELD_RANGE, g = heat / FIELD_RANGE, b = soot.
// The quad's vertices are in world pixels, so the noise is fixed to the world and does not slide with the
// camera. Pixi's y points down. Ported from the owner-approved spike.

import { FIELD_RANGE, NOISE_SCALE_PX } from './smokeTuning';

const glsl = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export const SMOKE_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vWorld;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vWorld = aPosition;
    vUV = aUV;
}`;

export const SMOKE_FRAGMENT = `
in vec2 vWorld;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uTime;
uniform float uFade;
uniform vec3 uSmokeColor;
uniform vec3 uSootColor;

const float RANGE = ${glsl(FIELD_RANGE)};

float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.52;
    for (int i = 0; i < 4; i++) {
        v += amp * noise2D(p);
        p = vec2(p.x * 0.80 - p.y * 0.60, p.x * 0.60 + p.y * 0.80) * 2.04 + vec2(1.7, 9.2);
        amp *= 0.48;
    }
    return v;
}
float densAt(vec2 uv) { return texture(uField, uv).r * RANGE; }

void main() {
    vec4 field = texture(uField, vUV);
    float dens = field.r * RANGE;
    if (dens < 0.004) discard;
    float dL = densAt(vUV - vec2(uTexel.x, 0.0));
    float dR = densAt(vUV + vec2(uTexel.x, 0.0));
    float dU = densAt(vUV - vec2(0.0, uTexel.y));
    float dD = densAt(vUV + vec2(0.0, uTexel.y));

    vec2 world = vWorld / ${glsl(NOISE_SCALE_PX)};
    vec2 flowShift = vec2(dL - dR, dU - dD) * 1.15;
    vec2 nCoord = world + flowShift + vec2(-uTime * 0.14, uTime * 0.24);
    float n1 = fbm(nCoord);
    float n2 = fbm(nCoord * 2.35 + vec2(uTime * 0.22, uTime * 0.16));
    float billow = n1 * 0.68 + n2 * 0.32;
    float modulated = dens * (0.6 + billow * 0.8);
    float alpha = 1.0 - exp(-modulated * 3.4);
    alpha *= smoothstep(0.008, 0.07, modulated);
    vec2 edge = min(vUV, 1.0 - vUV);
    alpha *= smoothstep(0.0, 0.14, min(edge.x, edge.y));
    alpha = min(alpha, 0.97) * uFade;
    if (alpha < 0.01) discard;

    vec3 N = normalize(vec3((dL - dR) * 4.5 + (n1 - 0.5) * 0.7, (dD - dU) * 4.5 + (n2 - 0.5) * 0.7, 0.45));
    float topLight = clamp(dot(N, normalize(vec3(-0.15, 0.92, 0.36))) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - clamp(dens * 1.3, 0.0, 1.0), 1.5);
    vec3 aerosol = mix(uSmokeColor, uSootColor, clamp(field.b * 1.6, 0.0, 1.0));
    vec3 shadowCol = aerosol * vec3(0.42, 0.46, 0.54);
    vec3 litCol = aerosol * vec3(1.12, 1.14, 1.16) + vec3(0.03) * rim;
    vec3 col = mix(shadowCol, litCol, topLight * 0.72 + billow * 0.28);
    float heat = smoothstep(0.08, 0.9, field.g * RANGE) * 0.9;
    col += vec3(1.0, 0.46, 0.14) * heat * (0.45 + billow * 0.55);
    finalColor = vec4(col * alpha, alpha);
}`;
