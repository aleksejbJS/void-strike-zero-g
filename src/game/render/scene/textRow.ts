// Lays out several texts left to right on a baked poster: each one starts where the previous
// one ended, plus a gap, and the whole row shrinks until it fits. Fixed x positions broke as soon
// as a fallback font was wider (the display font has no Cyrillic, so Russian falls back to Fira).

export interface RowText {
    text: string;
    color: string;
    weight: number;
    size: number;  // px at full scale
    y: number;     // baseline
}

type Ctx = Pick<CanvasRenderingContext2D, 'font' | 'fillStyle' | 'measureText' | 'fillText'>;

const MIN_SCALE = 0.5;
const STEP = 0.04;

/** Draws the row between `x` and `right`; returns the scale used (1 = sizes as given). */
export const textRow = (ctx: Ctx, items: RowText[], x: number, right: number, gap: number, family: string): number => {
    const fontOf = (it: RowText, k: number) => `${it.weight} ${Math.round(it.size * k)}px ${family}`;
    const widthAt = (k: number) => items.reduce((sum, it, i) => {
        ctx.font = fontOf(it, k);
        return sum + ctx.measureText(it.text).width + (i > 0 ? gap * k : 0);
    }, 0);
    let k = 1;
    while (k - STEP >= MIN_SCALE && x + widthAt(k) > right) k -= STEP;
    let cx = x;
    for (const it of items) {
        ctx.font = fontOf(it, k);
        ctx.fillStyle = it.color;
        ctx.fillText(it.text, cx, it.y);
        cx += ctx.measureText(it.text).width + gap * k;
    }
    return k;
};
