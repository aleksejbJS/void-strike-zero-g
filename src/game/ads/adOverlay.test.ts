import { describe, it, expect } from 'vitest';
import { bannerDocument, occlusionClip } from './adOverlay';

describe('occlusionClip', () => {
    const rect = { x: 100, y: 100, w: 150, h: 50 }; // a 300x100 banner shown at half size

    it('leaves the banner whole when nothing stands in front', () => {
        expect(occlusionClip(rect, 300, 100, [{ x: 400, y: 400, w: 50, h: 20 }])).toBe('none');
    });

    it('cuts a platform out in the banner\'s own coordinates', () => {
        const clip = occlusionClip(rect, 300, 100, [{ x: 50, y: 140, w: 500, h: 30 }]);
        // platform covers the bottom 10 screen px = bottom 20 banner px, full width
        expect(clip).toBe("path(evenodd, 'M0 0H300V100H0ZM0.0 80.0H300.0V100.0H0.0Z')");
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
