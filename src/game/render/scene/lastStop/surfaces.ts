import type { Platform } from '../../../../types';
import { LAST_STOP_MATERIALS as MATERIAL, mapPoint } from '../../../data/lastStop/layout';
import { LastStopArt, paintMaterial, paintProp, paintWear } from './artAssets';
import { paintCanopy, paintShaftRim } from './roundedDetails';

// Draw a cap on exposed ground edges. A taller neighboring slab can cover part of the surface.
const topRuns = (p: Platform, platforms: Platform[]): [number, number][] => {
    let runs: [number, number][] = [[p.x, p.x + p.w]];
    for (const other of platforms) {
        if (other.y >= p.y || other.y + other.h < p.y) continue;
        const left = other.x, right = other.x + other.w;
        runs = runs.flatMap(([a, b]): [number, number][] => {
            if (left >= b || right <= a) return [[a, b]];
            const remaining: [number, number][] = [];
            if (left > a) remaining.push([a, left]);
            if (right < b) remaining.push([right, b]);
            return remaining;
        });
    }
    return runs;
};

const shadeFace = (ctx: CanvasRenderingContext2D, p: Platform, strength: number) => {
    const gradient = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    gradient.addColorStop(0, 'rgba(245,181,111,0.10)');
    gradient.addColorStop(0.26, 'rgba(14,11,19,0)');
    gradient.addColorStop(1, `rgba(21,16,25,${strength})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(p.x, p.y, p.w, p.h);
};

const panels = (ctx: CanvasRenderingContext2D, p: Platform) => {
    const { x, y, w, h } = p;
    const rowH = h <= 110 ? h : 91;
    for (let top = y + 13; top + 19 < y + h - 9; top += rowH) {
        for (let left = x + 12; left + 24 < x + w - 9; left += 100) {
            const width = Math.min(88, x + w - left - 9), height = Math.min(rowH - 10, y + h - top - 9);
            ctx.strokeStyle = 'rgba(32,25,30,0.55)'; ctx.lineWidth = 2;
            ctx.strokeRect(left, top, width, height);
            ctx.fillStyle = 'rgba(231,185,127,0.20)';
            for (const bolt of [left + 5, left + width - 7]) ctx.fillRect(bolt, top + 5, 2, 2);
            if (width < 55 || height < 35) continue;
            ctx.fillStyle = 'rgba(22,23,28,0.29)';
            for (let s = 0; s < 4; s++) ctx.fillRect(left + 15, top + 11 + s * 5, width - 30, 2);
        }
    }
};

const brickDetails = (ctx: CanvasRenderingContext2D, p: Platform) => {
    if (p.w < 180 || p.h < 190) return;
    const { x, y, w, h } = p;
    ctx.fillStyle = 'rgba(103,78,65,0.78)';
    ctx.fillRect(x, y + h - 18, w, 18);
    ctx.fillStyle = 'rgba(41,26,32,0.52)';
    ctx.fillRect(x, y + 7, 10, h - 12);
    ctx.fillRect(x + w - 9, y + 7, 9, h - 12);
    ctx.fillRect(x + 26, y + 34, Math.min(142, w - 52), 29);
    ctx.fillStyle = 'rgba(178,145,114,0.24)';
    ctx.fillRect(x + 27, y + 34, Math.min(142, w - 52), 3);

    ctx.strokeStyle = '#332a2b';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x + 35, y + h - 22); ctx.lineTo(x + 35, y + 113);
    ctx.quadraticCurveTo(x + 35, y + 99, x + 50, y + 99);
    ctx.lineTo(x + 117, y + 99);
    ctx.stroke();
    ctx.fillStyle = '#90715c';
    for (let top = y + 123; top < y + h - 28; top += 68) ctx.fillRect(x + 27, top, 16, 5);
};

const body = (ctx: CanvasRenderingContext2D, art: LastStopArt, p: Platform) => {
    const { x, y, w, h, color } = p;
    if (color === MATERIAL.pump || color === MATERIAL.cabinet) {
        const prop = color === MATERIAL.pump ? art.props.pump : art.props.cabinet;
        ctx.fillStyle = '#4d3431';
        ctx.fillRect(x, y + h - 4, w, 4);
        paintProp(ctx, prop, x + w / 2, y + h, h, w);
        return;
    }
    if (color === MATERIAL.roof) {
        paintCanopy(ctx, art, p, x === 0);
        return;
    }
    if (color === MATERIAL.earth) {
        paintMaterial(ctx, art.materials.earth, x, y, w, h, 'rgba(31,24,29,0.27)');
    } else if (color === MATERIAL.masonry) {
        paintMaterial(ctx, art.materials.brick, x, y, w, h, 'rgba(65,36,37,0.2)');
        brickDetails(ctx, p);
    } else {
        paintMaterial(ctx, art.materials.steel, x, y, w, h, 'rgba(48,42,36,0.23)');
        panels(ctx, p);
    }
    shadeFace(ctx, p, color === MATERIAL.earth ? 0.44 : 0.27);
};

const shaftFrames = (ctx: CanvasRenderingContext2D, platforms: Platform[]) => {
    for (const span of [[107, 220], [832, 958], [1544, 1669]]) {
        for (const point of span) {
            const edge = mapPoint(point, 0).x;
            const slab = platforms.find(p => p.color === MATERIAL.earth && p.y < 1250
                && (p.x === edge || p.x + p.w === edge));
            if (!slab) continue;
            paintShaftRim(ctx, edge, slab.y, Math.min(slab.h, 128), slab.x === edge ? 1 : -1);
        }
    }
};

export const paintSurfaces = (ctx: CanvasRenderingContext2D, art: LastStopArt, platforms: Platform[]) => {
    const visible = platforms.filter(p => p.color !== MATERIAL.boundary);
    for (const p of visible) body(ctx, art, p);
    for (const p of visible) {
        if (p.color === MATERIAL.pump || p.color === MATERIAL.cabinet) continue;
        const isLedge = p.color === MATERIAL.steel && p.h < 43;
        for (const [left, end] of topRuns(p, visible)) {
            const color = isLedge ? '#c0904d' : p.color === MATERIAL.earth ? '#8e7460' : '#9f7360';
            ctx.fillStyle = '#312730';
            ctx.fillRect(left, p.y, end - left, 10);
            ctx.fillStyle = color;
            ctx.fillRect(left, p.y, end - left, 5);
            paintWear(ctx, left, p.y + 1, end - left, p.y);
        }
    }
    shaftFrames(ctx, visible);
};
