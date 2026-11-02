import { describe, it, expect } from 'vitest';
import { RowText, textRow } from './textRow';

/** A fake 2D context: every glyph is `glyph` × font size wide; records what was drawn where. */
const fakeCtx = (glyph: number) => {
    const drawn: { text: string; x: number; font: string }[] = [];
    const ctx = {
        font: '', fillStyle: '' as string | CanvasGradient | CanvasPattern,
        measureText: (text: string) => ({ width: text.length * glyph * Number(/(\d+)px/.exec(ctx.font)![1]) }) as TextMetrics,
        fillText: (text: string, x: number) => { drawn.push({ text, x, font: ctx.font }); },
    };
    return { ctx, drawn };
};

const ROW: RowText[] = [
    { text: 'ДЖЕТПАК', color: '#ffc21a', weight: 900, size: 46, y: 60 },
    { text: 'ПОЧИНИМ ЗА ЧАС', color: '#ece9e2', weight: 900, size: 46, y: 60 },
    { text: 'ДОК 4 · КРУГЛОСУТОЧНО', color: '#b7b2a8', weight: 600, size: 20, y: 56 },
];

describe('textRow', () => {
    it('puts every text after the end of the previous one', () => {
        const { ctx, drawn } = fakeCtx(0.3);
        const k = textRow(ctx, ROW, 34, 2000, 24, 'X');
        expect(k).toBe(1);
        const end0 = 34 + 'ДЖЕТПАК'.length * 0.3 * 46;
        expect(drawn[1].x).toBeCloseTo(end0 + 24);
        const end1 = drawn[1].x + 'ПОЧИНИМ ЗА ЧАС'.length * 0.3 * 46;
        expect(drawn[2].x).toBeCloseTo(end1 + 24);
    });

    it('shrinks the whole row when a wide fallback font would run past the edge', () => {
        const { ctx, drawn } = fakeCtx(0.55); // a wide font: the old fixed positions overlapped
        const k = textRow(ctx, ROW, 34, 714, 24, 'X');
        expect(k).toBeLessThan(1);
        const last = drawn[2];
        const lastSize = Number(/(\d+)px/.exec(last.font)![1]);
        expect(last.x + last.text.length * 0.55 * lastSize).toBeLessThanOrEqual(714 + 1);
        expect(drawn[1].x).toBeGreaterThan(drawn[0].x);
        expect(drawn[2].x).toBeGreaterThan(drawn[1].x);
    });

    it('never shrinks below half size', () => {
        const { ctx } = fakeCtx(5);
        expect(textRow(ctx, ROW, 0, 100, 10, 'X')).toBeGreaterThanOrEqual(0.5);
    });
});
