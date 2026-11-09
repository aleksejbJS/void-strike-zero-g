import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { ArtPartId, BodyArtDefinition, XY } from './artTypes';
import { artScale, placePart, type ArtTarget } from './placement';

interface AlphaImage { width: number; height: number; alpha: Uint8Array }
const pictures = new Map<string, AlphaImage>(), hulls = new Map<string, XY[]>();
const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
};

/** Decode the actual PNG alpha without a browser or an additional image dependency. */
const pngAlpha = (imagePath: string): AlphaImage => {
    const cached = pictures.get(imagePath); if (cached) return cached;
    const file = readFileSync(resolve('public', imagePath.replace(/^\//, '')));
    if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Not a PNG: ${imagePath}`);
    let width = 0, height = 0, channels = 0, color = 0;
    let transparency: Buffer | undefined;
    const compressed: Buffer[] = [];
    for (let at = 8; at < file.length;) {
        const size = file.readUInt32BE(at), kind = file.toString('ascii', at + 4, at + 8), data = file.subarray(at + 8, at + 8 + size);
        if (kind === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4); color = data[9];
            channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
            if (data[8] !== 8 || data[12] !== 0 || !channels) throw new Error(`Unsupported PNG encoding: ${imagePath}`);
        } else if (kind === 'IDAT') compressed.push(data);
        else if (kind === 'tRNS') transparency = data;
        at += size + 12;
    }
    if (!width || !height || !compressed.length) throw new Error(`Incomplete PNG: ${imagePath}`);
    const raw = inflateSync(Buffer.concat(compressed)), stride = width * channels;
    if (raw.length !== (stride + 1) * height) throw new Error(`Unexpected PNG scanline data: ${imagePath}`);
    const rows = new Uint8Array(stride * height), alpha = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter > 4) throw new Error(`Unsupported PNG filter ${filter}`);
        for (let x = 0; x < stride; x++) {
            const index = y * stride + x, a = x >= channels ? rows[index - channels] : 0;
            const b = y ? rows[index - stride] : 0, c = y && x >= channels ? rows[index - stride - channels] : 0;
            const prediction = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0;
            rows[index] = raw[y * (stride + 1) + x + 1] + prediction;
        }
        for (let x = 0; x < width; x++) {
            const index = y * stride + x * channels;
            alpha[y * width + x] = color === 6 ? rows[index + 3] : color === 4 ? rows[index + 1]
                : color === 3 ? transparency?.[rows[index]] ?? 255 : 255;
        }
    }
    const image = { width, height, alpha }; pictures.set(imagePath, image); return image;
};

const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const convexHull = (points: XY[]): XY[] => {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const half = (ordered: XY[]) => {
        const out: XY[] = [];
        for (const p of ordered) {
            while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
            out.push(p);
        }
        return out;
    };
    return [...half(points).slice(0, -1), ...half([...points].reverse()).slice(0, -1)];
};

/** Cache only opaque edge hulls: linear mesh transforms attain their lowest pixel on that hull. */
const paintedHull = (imagePath: string, polygon: readonly XY[]): XY[] => {
    const key = `${imagePath}:${polygon.flat().join(',')}`, cached = hulls.get(key); if (cached) return cached;
    const image = pngAlpha(imagePath), points: XY[] = [];
    const top = Math.max(0, Math.floor(Math.min(...polygon.map(p => p[1]))));
    const bottom = Math.min(image.height, Math.ceil(Math.max(...polygon.map(p => p[1]))));
    for (let y = top; y < bottom; y++) {
        const intersections: number[] = [], line = y + 0.5;
        polygon.forEach((p, i) => {
            const q = polygon[(i + 1) % polygon.length];
            if ((p[1] <= line && q[1] > line) || (q[1] <= line && p[1] > line))
                intersections.push(p[0] + (line - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
        });
        intersections.sort((a, b) => a - b);
        let first = image.width, last = -1;
        for (let i = 0; i < intersections.length; i += 2) {
            const start = Math.max(0, Math.ceil(intersections[i] - 0.5));
            const end = Math.min(image.width - 1, Math.floor(intersections[i + 1] - 0.5));
            for (let x = start; x <= end; x++) if (image.alpha[y * image.width + x] > 128) { first = Math.min(first, x); last = x; }
        }
        if (last >= first) points.push([first, y], [last + 1, y], [first, y + 1], [last + 1, y + 1]);
    }
    if (!points.length) throw new Error(`No opaque painted surface: ${key}`);
    const hull = convexHull(points); hulls.set(key, hull); return hull;
};

/** Opaque source extents expose crop-edge contamination before any rig transform is applied. */
export const paintedBounds = (imagePath: string, polygon: readonly XY[]) => {
    const hull = paintedHull(imagePath, polygon);
    return { left: Math.min(...hull.map(point => point[0])), right: Math.max(...hull.map(point => point[0])),
        top: Math.min(...hull.map(point => point[1])), bottom: Math.max(...hull.map(point => point[1])) };
};

export const paintedBottom = (definition: BodyArtDefinition, id: ArtPartId, target?: ArtTarget): number => {
    const part = definition.parts[id];
    if (!part || !target || target.visible === false) return -Infinity;
    const file = part.image?.imagePath ?? (part.texture === 'atlas' ? definition.atlas?.imagePath : definition.imagePath);
    if (!file) throw new Error(`Part ${id} has no source image`);
    const placement = placePart(part, target, artScale(definition));
    const dx = part.axisEnd ? part.axisEnd[0] - part.origin[0] : 0, dy = part.axisEnd ? part.axisEnd[1] - part.origin[1] : 1;
    const length = Math.hypot(dx, dy), c = Math.cos(placement.rotation), s = Math.sin(placement.rotation);
    return Math.max(...paintedHull(file, part.polygon).map(([x, y]) => {
        const rx = x - part.origin[0], ry = y - part.origin[1];
        const localX = (rx * dy - ry * dx) / length, localY = (rx * dx + ry * dy) / length;
        return placement.y + localX * placement.scaleX * s + localY * placement.scaleY * c;
    }));
};
