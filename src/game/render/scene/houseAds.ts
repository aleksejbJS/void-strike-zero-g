// House posters: our own in-world ads (fictional brands) shown when no network ad is served.
// One picture per standard banner size, drawn at the banner's native resolution.

import { makeCanvas } from './canvasKit';

export type AdSize = '300x250' | '300x100' | '728x90';

const FONT = '"Big Shoulders Display", "Fira Sans Extra Condensed", "Arial Narrow", sans-serif';

const orbitEnergy = () => {
    const { canvas, ctx } = makeCanvas(300, 250);
    const g = ctx.createLinearGradient(0, 0, 300, 250);
    g.addColorStop(0, '#2a0f4a'); g.addColorStop(1, '#0b0620');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 250);
    for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = `rgba(255,120,220,${0.06 + i * 0.01})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(80, 125, 30 + i * 14, 0, Math.PI * 2); ctx.stroke();
    }
    const cg = ctx.createLinearGradient(52, 0, 108, 0);
    cg.addColorStop(0, '#5b1ea0'); cg.addColorStop(0.45, '#d65cff'); cg.addColorStop(1, '#3b0f6e');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(52, 60, 56, 120, 10); ctx.fill();
    ctx.fillStyle = '#c9c9d6'; ctx.fillRect(55, 54, 50, 8);
    ctx.fillStyle = '#ffffff'; ctx.font = `900 54px ${FONT}`; ctx.fillText('ORBIT', 132, 118);
    ctx.fillStyle = '#ffd94a'; ctx.font = `800 28px ${FONT}`; ctx.fillText('ENERGY', 134, 150);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `600 16px ${FONT}`; ctx.fillText('ЗАРЯД НА ВСЮ СМЕНУ', 134, 182);
    return canvas;
};

const novaCargo = () => {
    const { canvas, ctx } = makeCanvas(300, 100);
    ctx.fillStyle = '#e8e2d2'; ctx.fillRect(0, 0, 300, 100);
    ctx.fillStyle = '#e4572e'; ctx.fillRect(0, 0, 92, 100);
    ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.arc(46, 50, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(46, 50, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e2d2'; ctx.fillRect(18, 47, 56, 6);
    ctx.fillStyle = '#1d1f24'; ctx.font = `900 38px ${FONT}`; ctx.fillText('NOVA CARGO', 104, 52);
    ctx.fillStyle = '#4a4d55'; ctx.font = `600 14px ${FONT}`; ctx.fillText('ДОСТАВКА ЗА ПРЕДЕЛЫ ОРБИТЫ', 106, 76);
    return canvas;
};

const voidLeague = () => {
    const { canvas, ctx } = makeCanvas(728, 90);
    const g = ctx.createLinearGradient(0, 0, 728, 0);
    g.addColorStop(0, '#0d3b2e'); g.addColorStop(1, '#06140f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 728, 90);
    ctx.fillStyle = '#a3e635'; ctx.font = `900 50px ${FONT}`; ctx.fillText('VOID LEAGUE', 24, 62);
    ctx.fillStyle = '#e7f5d0'; ctx.font = `700 26px ${FONT}`; ctx.fillText('ФИНАЛ СЕЗОНА — В СУББОТУ', 330, 58);
    return canvas;
};

const jetpackRepair = () => {
    const { canvas, ctx } = makeCanvas(728, 90);
    ctx.fillStyle = '#16181d'; ctx.fillRect(0, 0, 728, 90);
    ctx.fillStyle = '#ffc21a'; ctx.fillRect(0, 0, 14, 90);
    ctx.fillStyle = '#ffc21a'; ctx.font = `900 46px ${FONT}`; ctx.fillText('ДЖЕТПАК', 34, 60);
    ctx.fillStyle = '#ece9e2'; ctx.fillText('ПОЧИНИМ ЗА ЧАС', 250, 60);
    ctx.fillStyle = '#b7b2a8'; ctx.font = `600 20px ${FONT}`; ctx.fillText('ДОК 4 · КРУГЛОСУТОЧНО', 560, 56);
    return canvas;
};

let cache: Record<AdSize, HTMLCanvasElement[]> | null = null;

/** House creatives per size (several for rotating screens). Baked once. */
export const houseAds = (): Record<AdSize, HTMLCanvasElement[]> => {
    cache ??= { '300x250': [orbitEnergy()], '300x100': [novaCargo()], '728x90': [voidLeague(), jetpackRepair()] };
    return cache;
};
