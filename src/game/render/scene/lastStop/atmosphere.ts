import { LAST_STOP_ART_HEIGHT, LAST_STOP_WIDTH } from '../../../data/lastStop/layout';
import { glow, rnd } from '../canvasKit';

const GRADE = 1133;

const hill = (ctx: CanvasRenderingContext2D, height: number, color: string, period: number, seed: number) => {
    const r = rnd(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = period; x <= LAST_STOP_WIDTH + period; x += period) {
        const y = height - r() * 64;
        ctx.quadraticCurveTo(x - period / 2, y - 24, x, y);
    }
    ctx.lineTo(LAST_STOP_WIDTH, GRADE + 10);
    ctx.lineTo(0, GRADE + 10);
    ctx.fill();
};

const waterTower = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = '#675057';
    ctx.strokeStyle = '#695257';
    ctx.lineWidth = 5;
    ctx.fillRect(x - 33, y - 172, 66, 55);
    ctx.beginPath(); ctx.ellipse(x, y - 172, 33, 10, 0, 0, Math.PI * 2); ctx.fill();
    for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + side * 21, y - 117); ctx.lineTo(x + side * 33, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - side * 22, y - 108); ctx.lineTo(x + side * 31, y - 6); ctx.stroke();
    }
    ctx.fillRect(x - 32, y - 63, 64, 4);
};

export const paintAtmosphere = (ctx: CanvasRenderingContext2D, dusk?: HTMLImageElement) => {
    const sky = ctx.createLinearGradient(0, 70, 0, GRADE);
    sky.addColorStop(0, '#292532');
    sky.addColorStop(0.53, '#795565');
    sky.addColorStop(0.81, '#bd886e');
    sky.addColorStop(1, '#d8a574');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LAST_STOP_WIDTH, GRADE + 15);

    const r = rnd(431);
    if (dusk) {
        const scale = LAST_STOP_WIDTH / dusk.width;
        const height = dusk.height * scale;
        ctx.save();
        ctx.globalAlpha = 0.77;
        ctx.drawImage(dusk, 0, GRADE - height * 0.945, LAST_STOP_WIDTH, height);
        ctx.restore();
    } else {
        glow(ctx, 3040, 670, 480, '#e9a16b', 0.34);
        ctx.fillStyle = '#e4ad74';
        ctx.beginPath(); ctx.arc(3040, 678, 56, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 34; i++) {
            const x = r() * LAST_STOP_WIDTH, y = 410 + r() * 430, width = 80 + 270 * r();
            const cloud = ctx.createLinearGradient(0, y - 14, 0, y + 9);
            cloud.addColorStop(0, 'rgba(220,151,135,0)');
            cloud.addColorStop(0.53, 'rgba(224,157,131,0.13)');
            cloud.addColorStop(1, 'rgba(210,142,132,0)');
            ctx.fillStyle = cloud;
            ctx.beginPath(); ctx.ellipse(x, y, width, 8 + r() * 8, 0, 0, Math.PI * 2); ctx.fill();
        }

        hill(ctx, 1008, '#926d70', 252, 97);
        hill(ctx, 1056, '#775e65', 315, 43);
    }
    waterTower(ctx, 3260, 1090);
    hill(ctx, 1110, '#6a5151', 245, 125);
    ctx.strokeStyle = 'rgba(52,37,39,0.38)';
    ctx.lineWidth = 3;
    for (let x = 40; x < LAST_STOP_WIDTH; x += 110) {
        ctx.beginPath(); ctx.moveTo(x, GRADE + 15); ctx.lineTo(x + 3, 1069 + r() * 8); ctx.stroke();
    }
    for (const y of [1087, 1109]) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LAST_STOP_WIDTH, y + 4); ctx.stroke();
    }
    for (let i = 0; i < 460; i++) {
        const x = r() * LAST_STOP_WIDTH, y = 1090 + r() * 60;
        ctx.strokeStyle = i % 2 ? '#6a4f45' : '#967255';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r() * 14, y - 4 - r() * 21); ctx.stroke();
    }

    const soil = ctx.createLinearGradient(0, GRADE - 6, 0, LAST_STOP_ART_HEIGHT);
    soil.addColorStop(0, '#30262a');
    soil.addColorStop(0.65, '#252026');
    soil.addColorStop(1, '#19171e');
    ctx.fillStyle = soil;
    ctx.fillRect(0, GRADE, LAST_STOP_WIDTH, LAST_STOP_ART_HEIGHT - GRADE);
};
