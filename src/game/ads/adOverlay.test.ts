import { describe, it, expect } from 'vitest';
import { bannerDocument, occlusionClip } from './adOverlay';

describe('occlusionClip', () => {
    const rect = { x: 100, y: 100, w: 150, h: 50 }; // a 300x100 banner shown at half size

    it('leaves the banner whole when nothing stands in front', () => {
        expect(occlusionClip(rect, 300, 100, [{ x: 400, y: 400, w: 50, h: 20 }])).toBe('none');
    });

    it('cuts a platform out in the banner\'s own coordinates', () => {
        const clip = occlusionClip(rect, 300, 100, [{ x: 50, y: 140, w: 500, h: 30 }]);
        // platform covers the bottom 10 screen px = bottom 20 banner px, full width: only the top shows
        expect(clip).toBe("path('M0.0 0.0H300.0V80.0H0.0Z')");
    });

    it('keeps a crossing of two cut-outs cut (a girder over a pipe)', () => {
        const girder = { x: 150, y: 100, w: 20, h: 50 };   // vertical strip
        const pipe = { x: 100, y: 120, w: 150, h: 10 };     // horizontal band crossing it
        const clip = occlusionClip(rect, 300, 100, [girder, pipe]);
        // The crossing cell (banner x 100..140, y 40..60) must not be part of any visible cell
        const cells = [...clip.matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)/g)].map(m => m.slice(1).map(Number));
        const inside = cells.some(([x0, y0, x1, y1]) => 120 > x0 && 120 < x1 && 50 > y0 && 50 < y1);
        expect(inside).toBe(false);
    });
});

describe('bannerDocument', () => {
    it('wraps the spot code and reports back whether anything showed up', () => {
        const doc = bannerDocument('<script src="https://cdn.tsyndicate.com/x.js"></script>', 'vs-ad-7');
        expect(doc).toContain('cdn.tsyndicate.com/x.js');
        expect(doc).toContain('"vs-ad-7"');
        expect(doc).toContain('postMessage');
    });
});
