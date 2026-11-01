import { describe, it, expect } from 'vitest';
import { AD_PLACES, newConfig, parseConfigText, serialize } from './adsDraft';

describe('ads admin draft', () => {
    it('lists every in-world place, switched off and without code at first', () => {
        const config = newConfig();
        expect(Object.keys(config.places).sort()).toEqual(AD_PLACES.map(p => p.id).sort());
        Object.values(config.places).forEach(p => { expect(p.enabled).toBe(false); expect(p.code).toBe(''); });
    });

    it('round-trips through ads.json, keeping codes of switched-off places', () => {
        const config = newConfig();
        config.refreshSec = 90;
        config.places['station.wall-poster-a'] = { enabled: true, size: '300x250', code: '<script src="https://cdn.tsyndicate.com/a.js"></script>' };
        config.places['station.led-panel'] = { enabled: false, size: '728x90', code: '<script>kept</script>' };

        const parsed = parseConfigText(serialize(config));
        expect('config' in parsed).toBe(true);
        if (!('config' in parsed)) return;
        expect(parsed.config.refreshSec).toBe(90);
        expect(parsed.config.places['station.wall-poster-a'].enabled).toBe(true);
        expect(parsed.config.places['station.led-panel']).toEqual({ enabled: false, size: '728x90', code: '<script>kept</script>' });
    });

    it('never writes a place as enabled when it has no code', () => {
        const config = newConfig();
        config.places['station.container-decal'] = { enabled: true, size: '300x100', code: '   ' };
        expect(JSON.parse(serialize(config)).places['station.container-decal'].enabled).toBe(false);
    });

    it('explains a broken file instead of failing silently', () => {
        expect(parseConfigText('{oops')).toHaveProperty('error');
        expect(parseConfigText('{"version":2,"places":{}}')).toHaveProperty('error');
    });
});
