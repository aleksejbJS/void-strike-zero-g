import { glow } from '../canvasKit';
import { paintMaterial, paintWear } from './artAssets';
import type { LastStopArt } from './artAssets';

export interface ArtBox { x: number; y: number; w: number; h: number }

const curvedFascia = (ctx: CanvasRenderingContext2D, box: ArtBox) => {
    const { x, y, w, h } = box;
    const r = Math.min(h * 0.78, w / 4);
    const drop = Math.min(h * 0.76, r);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - drop);
    ctx.bezierCurveTo(x + w, y + h - 2, x + w - r * 0.42, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.bezierCurveTo(x + r * 0.42, y + h, x, y + h - 2, x, y + h - drop);
    ctx.closePath();
};

/** Painted curved underside under a straight roof deck. */
export const paintCanopy = (
    ctx: CanvasRenderingContext2D, art: LastStopArt, box: ArtBox, enamel: boolean,
) => {
    const { x, y, w, h } = box;
    ctx.save();
    curvedFascia(ctx, box);
    ctx.clip();
    paintMaterial(ctx, art.materials.steel, x, y, w, h, enamel ? 'rgba(119,43,37,0.83)' : 'rgba(104,52,43,0.58)');
    const shade = ctx.createLinearGradient(0, y, 0, y + h);
    shade.addColorStop(0, 'rgba(251,196,135,0.22)');
    shade.addColorStop(0.56, 'rgba(45,24,29,0.06)');
    shade.addColorStop(1, 'rgba(32,22,28,0.73)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, h);
    const pinstripe = y + h * 0.43;
    ctx.fillStyle = enamel ? '#c5ab83' : '#926958';
    ctx.fillRect(x, pinstripe, w, enamel ? 8 : 3);
    ctx.fillStyle = 'rgba(228,165,107,0.43)';
    ctx.fillRect(x, pinstripe, w, 1);
    paintWear(ctx, x + 3, y + h * 0.24, w - 6, x + y);
    ctx.restore();
    curvedFascia(ctx, box);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#3f2930';
    ctx.stroke();
};

const archPath = (ctx: CanvasRenderingContext2D, box: ArtBox, radius: number) => {
    const { x, y, w, h } = box;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.ellipse(x + w / 2, y + radius, w / 2, radius, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(x + w, y + h);
};

/** Recess seen in the back wall of a room or a tunnel. */
export const paintArch = (
    ctx: CanvasRenderingContext2D, art: LastStopArt, box: ArtBox, tone: 'warm' | 'dim',
) => {
    const { x, y, w, h } = box;
    const r = Math.min(78, w * 0.33, h * 0.44);
    const warm = tone === 'warm';
    ctx.save();
    archPath(ctx, box, r);
    ctx.closePath();
    ctx.clip();
    paintMaterial(ctx, art.materials.steel, x, y, w, h, warm ? 'rgba(27,21,27,0.74)' : 'rgba(28,25,32,0.48)');
    glow(ctx, x + w / 2, y + 53, w * 0.62, '#c58d58', warm ? 0.38 : 0.15);
    ctx.restore();
    const inset = Math.min(16, w * 0.1);
    archPath(ctx, box, r);
    ctx.strokeStyle = warm ? '#614640' : '#494044';
    ctx.lineWidth = inset;
    ctx.stroke();
    archPath(ctx, { x: x - 4, y: y - 4, w: w + 8, h: h + 4 }, r + 4);
    ctx.strokeStyle = warm ? 'rgba(202,153,112,0.58)' : 'rgba(144,122,110,0.44)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
};

export const paintWorkshopEave = (ctx: CanvasRenderingContext2D) => {
    // The sloping cladding is part of the wall plane, set behind its stepped catwalks.
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3659, 554);
    ctx.bezierCurveTo(3826, 512, 4229, 375, 4549, 272);
    ctx.quadraticCurveTo(4600, 254, 4638, 254);
    ctx.lineTo(4804, 254);
    ctx.strokeStyle = '#382832';
    ctx.lineWidth = 34;
    ctx.stroke();
    ctx.strokeStyle = '#714540';
    ctx.lineWidth = 23;
    ctx.stroke();
    ctx.translate(0, -6);
    ctx.strokeStyle = 'rgba(185,123,91,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
};

export const paintShaftRim = (ctx: CanvasRenderingContext2D, edge: number, y: number, height: number, side: number) => {
    ctx.save();
    ctx.translate(edge, y);
    ctx.scale(side, 1);
    // The metal rolls into the opening's wall. Its outer boundary stays inside the solid.
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, 14);
    ctx.quadraticCurveTo(0, 0, 16, 0);
    ctx.lineTo(35, 0);
    ctx.quadraticCurveTo(42, 0, 42, 5);
    ctx.quadraticCurveTo(42, 9, 35, 9);
    ctx.lineTo(23, 9);
    ctx.quadraticCurveTo(12, 9, 12, 25);
    ctx.lineTo(12, height - 8);
    ctx.quadraticCurveTo(12, height, 4, height);
    ctx.closePath();
    const brass = ctx.createLinearGradient(0, 0, 0, height);
    brass.addColorStop(0, '#d0a167');
    brass.addColorStop(0.16, '#927256');
    brass.addColorStop(1, '#524748');
    ctx.fillStyle = brass;
    ctx.fill();
    ctx.strokeStyle = '#453334';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let top = 31; top < height - 10; top += 25) {
        ctx.fillStyle = '#392e30';
        ctx.beginPath(); ctx.arc(6, top, 2.15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
};
