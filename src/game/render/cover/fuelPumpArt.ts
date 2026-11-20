import { COVER_SPECS, CoverStage } from '../../cover/coverTypes';
import { rnd } from '../scene/canvasKit';
import { lastStopPumpArt, paintProp } from '../scene/lastStop/artAssets';
import { contact, radialCracks, softGlow } from './coverArtKit';

const drawFallback = (c: CanvasRenderingContext2D, x: number, top: number, w: number, h: number) => {
    c.fillStyle = '#7e3d35';
    c.beginPath();
    c.roundRect(x + 3, top + 8, w - 6, h - 9, [7, 7, 2, 2]);
    c.fill();
    c.fillStyle = '#d0bb91';
    c.beginPath(); c.roundRect(x + 8, top + 13, w - 16, 32, 4); c.fill();
    c.fillStyle = '#383331';
    c.beginPath(); c.arc(x + w / 2, top + 26, 8, 0, Math.PI * 2); c.fill();
};

export const drawFuelPump = (c: CanvasRenderingContext2D, x: number, feet: number, stage: CoverStage, seed: number) => {
    const { w, h } = COVER_SPECS['fuel-pump'];
    const left = x - w / 2, top = feet - h;
    contact(c, x, feet, w * 0.78);

    if (stage === 3) {
        softGlow(c, x, feet - 2, w * 0.65, 'rgba(27,21,22,.78)', 0.2);
        c.fillStyle = '#4c352f';
        c.beginPath(); c.moveTo(left, feet); c.lineTo(left + 11, feet - 11);
        c.lineTo(x - 4, feet - 5); c.lineTo(x + 9, feet - 15);
        c.lineTo(x + w / 2, feet - 2); c.closePath(); c.fill();
        c.fillStyle = 'rgba(158,74,44,0.64)';
        c.fillRect(x - 3, feet - 5, 11, 2);
        return;
    }

    const art = lastStopPumpArt();
    if (art) paintProp(c, art, x, feet, h, w);
    else drawFallback(c, left, top, w, h);

    c.fillStyle = '#4d3431';
    c.fillRect(left, feet - 4, w, 4);
    if (stage === 0) return;
    c.save();
    c.beginPath(); c.roundRect(x - 15, top + 15, 27, h - 20, 5); c.clip();
    softGlow(c, x + 1, top + 49, stage === 1 ? 13 : 25, 'rgba(26,19,20,.75)');
    radialCracks(c, x + 1, top + 49, stage + 2, 15, rnd(seed), '#382623', '#9e7c64');
    c.restore();
};
