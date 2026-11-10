// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BodyArtDefinition, SourcePart, XY } from '../artTypes';
import { partGeometry } from '../placement';

// Painted bases only: the Robot is a 3D kit with its own invariants in robotKit.test.ts
const ids = ['human', 'human-female', 'toxic', 'cat'] as const;
const requiredParts = [
    'head', 'torso', 'pelvis', 'upperArmFront', 'upperArmBack',
    'forearmFront', 'forearmBack', 'handFront', 'handBack',
    'thighFront', 'thighBack', 'shinFront', 'shinBack', 'footFront', 'footBack',
] as const;
const boneParts = [
    'torso', 'pelvis', 'upperArmFront', 'upperArmBack',
    'forearmFront', 'forearmBack', 'thighFront', 'thighBack', 'shinFront', 'shinBack',
] as const;

async function definitions(): Promise<Record<typeof ids[number], BodyArtDefinition>> {
    expect(existsSync(resolve('src/game/render/characters/definitions.ts'))).toBe(true);
    return (await import('../definitions')).BODY_ART;
}

function polygonArea(part: SourcePart): number {
    return Math.abs(part.polygon.reduce((area, point, index, polygon) => {
        const next = polygon[(index + 1) % polygon.length];
        return area + point[0] * next[1] - next[0] * point[1];
    }, 0)) / 2;
}

function hasCrossedEdges(polygon: readonly XY[]): boolean {
    const side = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let first = 0; first < polygon.length; first++) {
        for (let second = first + 2; second < polygon.length; second++) {
            if (first === 0 && second === polygon.length - 1) continue;
            const a = polygon[first], b = polygon[(first + 1) % polygon.length];
            const c = polygon[second], d = polygon[(second + 1) % polygon.length];
            if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
        }
    }
    return false;
}

describe('approved character source geometry', () => {
    it.each(ids)('%s supplies bounded, nonempty meshes for every detachable limb', async id => {
        const body = (await definitions())[id];
        expect(body.id).toBe(id);
        expect(body.size).toEqual([1024, 1536]);
        expect(Math.hypot(body.neck[0] - body.hip[0], body.neck[1] - body.hip[1])).toBeGreaterThan(250);
        for (const name of requiredParts) expect(body.parts[name], `${id}.${name}`).toBeDefined();
        expect(Boolean(body.parts.tail)).toBe(id === 'cat');
        for (const [name, part] of Object.entries(body.parts)) {
            expect(part.polygon.length, `${id}.${name}`).toBeGreaterThanOrEqual(3);
            expect(polygonArea(part), `${id}.${name}`).toBeGreaterThan(100);
            expect(hasCrossedEdges(part.polygon), `${id}.${name} has crossed clipping edges`).toBe(false);
            for (const point of [...part.polygon, part.origin, ...(part.axisEnd ? [part.axisEnd] : [])]) {
                expect(point.every(Number.isFinite)).toBe(true);
                expect(point[0]).toBeGreaterThanOrEqual(0);
                expect(point[0]).toBeLessThanOrEqual(1024);
                expect(point[1]).toBeGreaterThanOrEqual(0);
                expect(point[1]).toBeLessThanOrEqual(1536);
            }
        }
        for (const name of boneParts) {
            const part = body.parts[name]!;
            expect(part.axisEnd, `${id}.${name}`).toBeDefined();
            expect(Math.hypot(part.axisEnd![0] - part.origin[0], part.axisEnd![1] - part.origin[1])).toBeGreaterThan(50);
        }
        for (const name of ['head', 'handFront', 'handBack', 'footFront', 'footBack'] as const) {
            expect(body.parts[name]!.axisEnd).toBeUndefined();
        }
        for (const name of ['torso', 'pelvis'] as const) {
            expect(body.parts[name]!.origin).toEqual(body.hip);
            expect(body.parts[name]!.axisEnd).toEqual(body.neck);
        }
        for (const name of ['footFront', 'footBack'] as const) {
            const foot = body.parts[name]!;
            const soleDepth = Math.max(...foot.polygon.map(point => point[1])) - foot.origin[1];
            expect(soleDepth).toBeGreaterThanOrEqual(40);
            expect(soleDepth).toBeLessThanOrEqual(65);
        }
    });

    it.each(ids)('%s triangulates every authored cutout with unchanged source UVs', async id => {
        const body = (await definitions())[id];
        for (const [name, part] of Object.entries(body.parts)) {
            const geometry = partGeometry(part, body.size);
            expect(geometry.positions.length, `${id}.${name}`).toBe(part.polygon.length * 2);
            expect([...geometry.positions].every(Number.isFinite), `${id}.${name}`).toBe(true);
            expect(geometry.indices.length, `${id}.${name}`).toBe((part.polygon.length - 2) * 3);
            let coveredArea = 0;
            for (let index = 0; index < geometry.indices.length; index += 3) {
                const triangle = [...geometry.indices.slice(index, index + 3)].map(vertex => part.polygon[vertex]);
                expect(triangle.every(Boolean), `${id}.${name}`).toBe(true);
                coveredArea += polygonArea({ ...part, polygon: triangle });
            }
            expect(coveredArea, `${id}.${name}`).toBeCloseTo(polygonArea(part), 5);
            part.polygon.forEach(([x, y], index) => {
                expect(geometry.uvs[index * 2], `${id}.${name}.u${index}`).toBeCloseTo(x / body.size[0], 6);
                expect(geometry.uvs[index * 2 + 1], `${id}.${name}.v${index}`).toBeCloseTo(y / body.size[1], 6);
            });
        }
    });

    it.each(ids)('%s serves the approved PNG pixels without raster changes', async id => {
        const body = (await definitions())[id];
        const source = resolve(`art/characters/atompunk/base-samples/${id}-base-v1.png`);
        const destination = resolve(`public${body.imagePath}`);
        expect(existsSync(destination)).toBe(true);
        const original = readFileSync(source);
        const published = readFileSync(destination);
        const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');
        expect(digest(published)).toBe(digest(original));
        expect([published.readUInt32BE(16), published.readUInt32BE(20)]).toEqual([1024, 1536]);
        const provenancePath = resolve('public/assets/characters/atompunk/provenance.json');
        expect(existsSync(provenancePath)).toBe(true);
        const provenance = JSON.parse(readFileSync(provenancePath, 'utf8')) as {
            assets: { id: string; source: string; imagePath: string; sha256: string }[];
        };
        expect(provenance.assets.find(asset => asset.id === id)).toMatchObject({
            source: `art/characters/atompunk/base-samples/${id}-base-v1.png`,
            imagePath: body.imagePath,
            sha256: digest(original),
        });
    });
});
