import { describe, it, expect } from 'vitest';
import { assetUrl } from './assetUrl';

describe('assetUrl', () => {
    it('puts the site base in front of a public file, never a domain-root path', () => {
        const url = assetUrl('/assets/hud/health.png');
        expect(url.endsWith('assets/hud/health.png')).toBe(true);
        expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true);
        expect(url).not.toMatch(/^\/\//);
    });
});
