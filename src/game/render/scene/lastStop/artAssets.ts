import { assetUrl } from '../../../../assetUrl';
import { makeCanvas } from '../canvasKit';

type Material = 'brick' | 'steel' | 'earth' | 'wood';
type Prop = 'pump' | 'door' | 'window' | 'generator' | 'cabinet' | 'tv';

export interface LastStopArt {
    materials: Record<Material, HTMLCanvasElement>;
    props: Record<Prop, HTMLCanvasElement>;
    dusk?: HTMLImageElement;
}

const asset = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load Last Stop art: ${name}`));
    image.src = assetUrl(`assets/maps/last-stop/${name}.webp`);
});

const materialTile = (atlas: HTMLImageElement, col: number, row: number, size: number) => {
    const { canvas, ctx } = makeCanvas(size * 2, size * 2);
    const w = atlas.width / 2, h = atlas.height / 2;
    // Mirrored edges keep tiled materials continuous at world scale.
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
        ctx.save();
        ctx.translate(x * size * 2, y * size * 2);
        ctx.scale(x === 0 ? 1 : -1, y === 0 ? 1 : -1);
        ctx.drawImage(atlas, col * w + 6, row * h + 6, w - 12, h - 12, 0, 0, size, size);
        ctx.restore();
    }
    return canvas;
};

const propTile = (atlas: HTMLImageElement, col: number, row: number) => {
    const w = Math.floor(atlas.width / 3);
    const rowBreak = Math.round(atlas.height * 0.56);
    const originY = row === 0 ? 0 : rowBreak;
    const h = row === 0 ? rowBreak : atlas.height - rowBreak;
    const { ctx } = makeCanvas(w, h);
    ctx.drawImage(atlas, col * w, originY, w, h, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    let left = w, right = -1, top = h, bottom = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] < 48) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error(`Missing Last Stop prop in atlas cell ${col},${row}`);
    const cut = makeCanvas(right - left + 1, bottom - top + 1);
    cut.ctx.drawImage(atlas, col * w + left, originY + top, cut.canvas.width, cut.canvas.height,
        0, 0, cut.canvas.width, cut.canvas.height);
    return cut.canvas;
};

let cachedArt: Promise<LastStopArt> | undefined;

export const loadLastStopArt = (): Promise<LastStopArt> => {
    cachedArt ??= Promise.all([
        asset('materials'), asset('props'), asset('dusk').catch((error: unknown) => {
            console.warn('Last Stop will use its painted sky.', error);
            return undefined;
        }),
    ]).then(([tiles, props, dusk]) => ({
        dusk,
        materials: {
            brick: materialTile(tiles, 0, 0, 256),
            steel: materialTile(tiles, 1, 0, 320),
            earth: materialTile(tiles, 0, 1, 484),
            wood: materialTile(tiles, 1, 1, 336),
        },
        props: {
            pump: propTile(props, 0, 0),
            door: propTile(props, 1, 0),
            window: propTile(props, 2, 0),
            generator: propTile(props, 0, 1),
            cabinet: propTile(props, 1, 1),
            tv: propTile(props, 2, 1),
        },
    })).catch((error: unknown) => {
        cachedArt = undefined;
        throw error;
    });
    return cachedArt;
};

export const paintMaterial = (
    ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, x: number, y: number, w: number, h: number,
    shade: string,
) => {
    ctx.fillStyle = ctx.createPattern(tile, 'repeat') ?? shade;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, h);
};

export const paintProp = (
    ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, feet: number, height: number, maxWidth = Infinity,
) => {
    const scale = Math.min(height / sprite.height, maxWidth / sprite.width);
    const w = sprite.width * scale, h = sprite.height * scale;
    ctx.drawImage(sprite, x - w / 2, feet - h, w, h);
};

export const paintWear = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) => {
    // A fixed pattern in world space keeps paint chips from changing as the camera moves.
    for (let i = 0; i < w / 12; i++) {
        const jitter = ((seed + i * 1873) % 61) / 61;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(32,22,21,0.35)' : 'rgba(247,209,143,0.18)';
        ctx.fillRect(x + i * 12 + jitter * 8, y + jitter * 6, 1 + jitter * 4, 1 + jitter * 2);
    }
};
