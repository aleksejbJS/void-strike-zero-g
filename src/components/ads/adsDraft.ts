// The ads admin page's working copy of ads.json: which places exist, their human
// descriptions, and saving the draft in this browser between visits.

import { AdConfig, AdPlaceConfig, DEFAULT_REFRESH_SEC, emptyAdConfig, validateAdConfig } from '../../game/ads/adConfig';
import { STATION_AD_PLACES } from '../../game/render/scene/adPlaces';
import { MINE_AD_PLACES } from '../../game/render/scene/themes/mineTheme';
import { ARENA_AD_PLACES } from '../../game/render/scene/themes/arenaTheme';
import { PIT_AD_PLACES } from '../../game/render/scene/themes/pitTheme';

const DRAFT_KEY = 'void-strike.ads-draft';

export interface PlaceInfo {
    id: string;
    name: string;
    where: string;
    size: AdPlaceConfig['size'];
    kind: 'lightbox' | 'decal' | 'screen';
}

const DESCRIPTIONS: Record<string, { name: string; where: string }> = {
    'station.wall-poster-a': { name: 'Световой короб на стене', where: 'Станция: стена, левее центра карты' },
    'station.wall-poster-b': { name: 'Световой короб на стене', where: 'Станция: стена, правая часть карты' },
    'station.container-decal': { name: 'Наклейка на контейнере', where: 'Станция: центр, контейнер C-12 у пола' },
    'station.led-panel': { name: 'Светодиодная панель', where: 'Станция: левая часть, под трубами' },
    'mine.board-a': { name: 'Щит с подсветкой на скале', where: 'Тоннели: стена шахты, левее центра' },
    'mine.board-b': { name: 'Щит с подсветкой на скале', where: 'Тоннели: стена шахты, правая часть' },
    'mine.crate-decal': { name: 'Наклейка на ящике', where: 'Тоннели: центр, ящик ORE-3 у пола' },
    'mine.led-panel': { name: 'Светодиодная панель', where: 'Тоннели: левая часть, под вентиляцией' },
    'arena.screen-a': { name: 'Большой экран над трибунами', where: 'Голодные игры: трибуны, центр арены' },
    'arena.screen-b': { name: 'Большой экран над трибунами', where: 'Голодные игры: трибуны, правее центра' },
    'arena.ribbon': { name: 'Светодиодная лента', where: 'Голодные игры: фермы, левая часть арены' },
    'pit.wall-poster-a': { name: 'Световой короб на стене', where: 'Яма (турнир): стена, левая часть арены' },
    'pit.wall-poster-b': { name: 'Световой короб на стене', where: 'Яма (турнир): стена, правее центра' },
};

export const AD_PLACES: PlaceInfo[] = [...STATION_AD_PLACES, ...MINE_AD_PLACES, ...ARENA_AD_PLACES, ...PIT_AD_PLACES].map(p => ({
    id: p.id,
    size: p.size,
    kind: p.kind,
    name: DESCRIPTIONS[p.id]?.name ?? p.id,
    where: DESCRIPTIONS[p.id]?.where ?? '',
}));

/** Every known place present in the config (new places start switched off). */
export const withAllPlaces = (config: AdConfig): AdConfig => {
    const places = { ...config.places };
    for (const p of AD_PLACES) places[p.id] ??= { enabled: false, size: p.size, code: '' };
    return { ...config, places };
};

export const serialize = (config: AdConfig) => JSON.stringify({
    version: 1,
    refreshSec: config.refreshSec,
    places: Object.fromEntries(Object.entries(config.places).map(([id, p]) => [id, { enabled: p.enabled && p.code.trim() !== '', size: p.size, code: p.code }])),
}, null, 2);

export const parseConfigText = (text: string): { config: AdConfig } | { error: string } => {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        return { error: `Файл не похож на JSON: ${(err as Error).message}` };
    }
    const result = validateAdConfig(raw);
    if (result.ok === false) return { error: result.error };
    // Keep codes of switched-off places too: the admin page edits them
    const places = (raw as { places: Record<string, AdPlaceConfig> }).places;
    Object.entries(result.config.places).forEach(([id, p]) => { p.enabled = places[id]?.enabled === true; });
    return { config: withAllPlaces(result.config) };
};

export const loadDraft = (): AdConfig | null => {
    try {
        const text = localStorage.getItem(DRAFT_KEY);
        if (!text) return null;
        const parsed = parseConfigText(text);
        return 'config' in parsed ? parsed.config : null;
    } catch (err) {
        console.warn('Ads admin: could not read the saved draft', err);
        return null;
    }
};

export const saveDraft = (config: AdConfig) => {
    try {
        localStorage.setItem(DRAFT_KEY, serialize(config));
    } catch (err) {
        console.warn('Ads admin: could not save the draft in this browser', err);
    }
};

export const clearDraft = () => {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
        console.warn('Ads admin: could not clear the draft', err);
    }
};

export const newConfig = () => withAllPlaces({ ...emptyAdConfig(), refreshSec: DEFAULT_REFRESH_SEC });
