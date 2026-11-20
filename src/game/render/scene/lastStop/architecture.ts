import { glow } from '../canvasKit';
import { LastStopArt, paintMaterial, paintProp, paintWear } from './artAssets';
import { paintArch, paintCanopy, paintWorkshopEave } from './roundedDetails';

const fill = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
};

const frame = (ctx: CanvasRenderingContext2D, x: number, top: number, w: number, feet: number, material: string) => {
    const shade = ctx.createLinearGradient(0, top, 0, feet);
    shade.addColorStop(0, 'rgba(9,11,17,0.72)');
    shade.addColorStop(0.55, 'rgba(23,20,27,0.24)');
    shade.addColorStop(1, 'rgba(19,17,22,0.63)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, top, w, feet - top);
    for (const side of [x, x + w - 13]) {
        fill(ctx, material, side, top, 13, feet - top);
        fill(ctx, 'rgba(231,165,111,0.18)', side + 2, top, 2, feet - top);
    }
    fill(ctx, material, x, feet - 11, w, 11);
    fill(ctx, 'rgba(227,169,119,0.12)', x, feet - 10, w, 2);
};

const sign = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wording: string) => {
    ctx.fillStyle = '#2c2529';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 4, w, h, 6); ctx.fill();
    ctx.fillStyle = '#823b35';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
    ctx.strokeStyle = '#c08f66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 3); ctx.stroke();
    ctx.fillStyle = '#ead2a4';
    ctx.font = `bold ${Math.floor(h * 0.66)}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(wording, x + w / 2, y + h * 0.55, w - 22);
    paintWear(ctx, x + 7, y + 2, w - 15, x);
    for (const bolt of [x + 8, x + w - 8]) fill(ctx, '#542f30', bolt - 1, y + h / 2 - 1, 3, 3);
};

const lamp = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    glow(ctx, x, y + 11, radius, '#eda264', 0.28);
    fill(ctx, '#34272a', x - 13, y - 5, 26, 6);
    fill(ctx, '#d8a668', x - 8, y + 1, 16, 3);
};

const beam = (ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number, width: number) => {
    ctx.strokeStyle = '#30292d'; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.strokeStyle = 'rgba(151,108,77,0.46)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - width / 2 + 2, y); ctx.lineTo(endX - width / 2 + 2, endY); ctx.stroke();
};

const storefront = (ctx: CanvasRenderingContext2D, art: LastStopArt) => {
    const floor = 1133;
    for (const x of [46, 598, 1370]) {
        beam(ctx, x, 618, x, floor, 17);
        beam(ctx, x, 671, x + (x === 1370 ? -96 : 96), 618, 11);
    }
    fill(ctx, '#34292d', 65, 669, 530, 12);
    fill(ctx, '#34292d', 65, 805, 530, 12);
    fill(ctx, '#65463b', 65, 804, 530, 3);
    for (const [x, endX] of [[70, 184], [184, 298], [298, 412], [412, 526]]) {
        beam(ctx, x, 807, endX, 673, 10);
        beam(ctx, x, 673, endX, 807, 7);
    }
    paintMaterial(ctx, art.materials.wood, 64, 890, 515, floor - 890, 'rgba(43,34,41,0.32)');
    frame(ctx, 64, 890, 515, floor, '#423136');
    paintCanopy(ctx, art, { x: 54, y: 883, w: 540, h: 59 }, true);
    paintArch(ctx, art, { x: 83, y: 997, w: 98, h: floor - 997 }, 'warm');
    sign(ctx, 115, 850, 211, 44, 'LAST STOP');
    sign(ctx, 340, 864, 100, 29, 'FUEL');
    paintProp(ctx, art.props.door, 132, floor - 8, 108, 63);
    paintProp(ctx, art.props.window, 289, 1057, 57, 123);
    paintProp(ctx, art.props.window, 443, 1057, 57, 123);
    fill(ctx, '#423035', 381, 1062, 106, 6);
    paintProp(ctx, art.props.tv, 435, 1061, 34, 52);
    for (const x of [197, 389, 823, 1136]) lamp(ctx, x, x < 500 ? 960 : 631, 112);
};

const pumpHouse = (ctx: CanvasRenderingContext2D, art: LastStopArt) => {
    const y = 1190;
    paintMaterial(ctx, art.materials.brick, 1875, 681, 985, y - 681, 'rgba(32,24,34,0.55)');
    frame(ctx, 1875, 681, 985, y, '#48323a');
    for (const top of [745, 917]) {
        fill(ctx, '#393036', 1890, top, 953, 9);
        fill(ctx, '#664c47', 1890, top, 953, 2);
    }
    sign(ctx, 2075, 709, 192, 39, 'PUMP HOUSE');
    for (const x of [1965, 2311, 2663]) {
        paintProp(ctx, art.props.window, x, 879, 60, 128);
        lamp(ctx, x + 34, 965, 115);
    }
    paintArch(ctx, art, { x: 2111, y: 960, w: 470, h: y - 960 }, 'warm');
    paintProp(ctx, art.props.door, 1999, y - 10, 108);
    paintProp(ctx, art.props.generator, 2220, y - 10, 63, 109);
    paintProp(ctx, art.props.door, 2708, y - 10, 108);
    paintProp(ctx, art.props.cabinet, 2617, y - 10, 66, 75);
    for (const x of [2069, 2505]) beam(ctx, x, 749, x, y - 12, 12);
};

const workshop = (ctx: CanvasRenderingContext2D, art: LastStopArt) => {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(3650, 533); ctx.lineTo(4550, 248); ctx.lineTo(4800, 248);
    ctx.lineTo(4800, 1133); ctx.lineTo(3650, 1151); ctx.closePath(); ctx.clip();
    paintMaterial(ctx, art.materials.wood, 3650, 244, 1150, 907, 'rgba(34,29,38,0.46)');
    frame(ctx, 3650, 244, 1150, 1151, '#422f33');
    for (const y of [580, 776, 906]) {
        fill(ctx, '#413136', 3650, y, 1150, 14);
        fill(ctx, '#6a4a43', 3650, y + 2, 1150, 2);
    }
    for (const x of [3730, 4130, 4540, 4790]) {
        beam(ctx, x, 400, x, 1150, 15);
        beam(ctx, x, 853, x + 54, 785, 10);
    }
    paintArch(ctx, art, { x: 3738, y: 950, w: 328, h: 192 }, 'warm');
    paintArch(ctx, art, { x: 4390, y: 939, w: 324, h: 191 }, 'warm');
    sign(ctx, 3812, 600, 174, 42, 'SERVICE');
    for (const x of [3840, 4240, 4630]) {
        paintProp(ctx, art.props.window, x, 860, 65, 130);
        lamp(ctx, x, 952, 116);
    }
    for (const x of [3802, 4417, 4722]) paintProp(ctx, art.props.door, x, 1126, 108, 58);
    paintProp(ctx, art.props.cabinet, 3972, 1146, 76, 86);
    paintProp(ctx, art.props.generator, 4679, 1126, 66, 104);
    ctx.restore();
    paintWorkshopEave(ctx);
};

const basement = (ctx: CanvasRenderingContext2D, art: LastStopArt) => {
    paintMaterial(ctx, art.materials.steel, 285, 1133, 4230, 675, 'rgba(36,29,38,0.69)');
    for (let x = 350; x < 4500; x += 194) fill(ctx, 'rgba(15,14,24,0.30)', x, 1322, 2, 493);
    for (let y = 1358; y < 1810; y += 94) fill(ctx, 'rgba(20,17,27,0.36)', 294, y, 4202, 2);
    for (const x of [446, 819, 1325, 1859, 2421, 2898, 3491, 4012, 4350]) lamp(ctx, x, 1515, 138);
    for (const [x, y] of [[795, 1765], [1820, 1800], [2890, 1800], [3978, 1742]]) {
        paintArch(ctx, art, { x: x - 118, y: y - 260, w: 236, h: 260 }, 'dim');
        paintProp(ctx, art.props.door, x, y - 6, 108, 61);
    }
    paintProp(ctx, art.props.generator, 3254, 1800, 64, 110);
    paintProp(ctx, art.props.cabinet, 3777, 1703, 76, 84);
    fill(ctx, '#32292f', 554, 1608, 3580, 7);
    fill(ctx, '#6c5347', 554, 1608, 3580, 2);
};

export const paintArchitecture = (ctx: CanvasRenderingContext2D, art: LastStopArt) => {
    basement(ctx, art);
    storefront(ctx, art);
    pumpHouse(ctx, art);
    workshop(ctx, art);
};
