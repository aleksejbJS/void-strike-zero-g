// Ad settings: which in-world places show a TrafficStars spot, loaded from public/ads.json.
// A missing or broken file means house posters everywhere — the game never depends on it.

export const AD_SIZES = ['300x250', '300x100', '728x90'] as const;
export type AdSpotSize = (typeof AD_SIZES)[number];

export interface AdPlaceConfig {
    enabled: boolean;
    size: AdSpotSize;
    code: string; // TrafficStars spot code (HTML/JS), runs only inside a sandboxed iframe
}

export interface AdConfig {
    version: 1;
    refreshSec: number;
    places: Record<string, AdPlaceConfig>;
}

export const DEFAULT_REFRESH_SEC = 60;
const MIN_REFRESH_SEC = 30;
const MAX_CODE_LENGTH = 20000;

export const emptyAdConfig = (): AdConfig => ({ version: 1, refreshSec: DEFAULT_REFRESH_SEC, places: {} });

export type ConfigResult = { ok: true; config: AdConfig; warnings: string[] } | { ok: false; error: string };

const isSize = (v: unknown): v is AdSpotSize => typeof v === 'string' && (AD_SIZES as readonly string[]).includes(v);

/** Check a parsed ads.json. Bad places are skipped with a warning; a bad file is an error. */
export const validateAdConfig = (raw: unknown): ConfigResult => {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'ads.json must be an object' };
    const data = raw as Record<string, unknown>;
    if (data.version !== 1) return { ok: false, error: `unsupported ads.json version: ${String(data.version)}` };
    const places = data.places;
    if (!places || typeof places !== 'object') return { ok: false, error: 'ads.json has no "places" object' };

    const warnings: string[] = [];
    const config = emptyAdConfig();
    const refresh = Number(data.refreshSec ?? DEFAULT_REFRESH_SEC);
    config.refreshSec = Number.isFinite(refresh) ? Math.max(MIN_REFRESH_SEC, refresh) : DEFAULT_REFRESH_SEC;

    for (const [id, value] of Object.entries(places as Record<string, unknown>)) {
        const p = value as Partial<AdPlaceConfig> | null;
        if (!p || typeof p !== 'object') { warnings.push(`${id}: not an object`); continue; }
        if (!isSize(p.size)) { warnings.push(`${id}: unknown size "${String(p.size)}"`); continue; }
        const code = typeof p.code === 'string' ? p.code.trim() : '';
        if (code.length > MAX_CODE_LENGTH) { warnings.push(`${id}: code is too long`); continue; }
        config.places[id] = { enabled: p.enabled === true && code.length > 0, size: p.size, code };
    }
    return { ok: true, config, warnings };
};

/** Load ads.json next to the game. Problems are logged and fall back to house posters. */
export const loadAdConfig = async (url: string): Promise<AdConfig> => {
    try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.status === 404) return emptyAdConfig();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = validateAdConfig(await res.json());
        if (result.ok === false) {
            console.warn(`Ads disabled: ${result.error}`);
            return emptyAdConfig();
        }
        result.warnings.forEach(w => console.warn(`ads.json: ${w}`));
        return result.config;
    } catch (err) {
        console.warn('Ads disabled: could not load ads.json', err);
        return emptyAdConfig();
    }
};

/** Does pasted code look like a TrafficStars spot? (Used by the admin page as a hint.) */
export const looksLikeTrafficStars = (code: string) => /tsyndicate|trafficstars|tsy\./i.test(code);
