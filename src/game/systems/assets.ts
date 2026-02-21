
import { Assets, Texture } from 'pixi.js';
import { ItemType } from '../../types';

// Cache for loaded textures to avoid re-loading
let cachedTextures: Record<string, Texture> | null = null;
let loadingPromise: Promise<Record<string, Texture>> | null = null;

export const generateAssets = async (): Promise<Record<string, Texture>> => {
    // Return cached textures if already loaded
    if (cachedTextures) {
        return cachedTextures;
    }

    // If already loading, return the same promise
    if (loadingPromise) {
        return loadingPromise;
    }

    // Start loading
    loadingPromise = loadAssetsInternal();

    try {
        cachedTextures = await loadingPromise;
        return cachedTextures;
    } finally {
        loadingPromise = null;
    }
};

const loadAssetsInternal = async (): Promise<Record<string, Texture>> => {
    const getSVGDataURI = (svgContent: string) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${svgContent}</svg>`;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    };

    const armorFallback = getSVGDataURI(`<path d="M14 10 L22 4 L42 4 L50 10 L50 50 L42 58 L22 58 L14 50 Z" fill="#2563eb" stroke="#1e40af" stroke-width="2"/><rect x="22" y="16" width="20" height="32" rx="2" fill="#60a5fa"/><path d="M14 24 L22 24 M42 24 L50 24 M14 40 L22 40 M42 40 L50 40" stroke="#1d4ed8" stroke-width="2"/>`);
    const fuelFallback = getSVGDataURI(`<rect x="16" y="12" width="32" height="40" rx="4" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/><rect x="24" y="20" width="16" height="24" fill="#60a5fa"/><path d="M32 12 L32 8 L40 8 L40 12" stroke="#1d4ed8" stroke-width="2" fill="none"/>`);
    const flagFallback = getSVGDataURI(`<g><rect x="26" y="8" width="4" height="50" fill="#4b5563"/><circle cx="28" cy="8" r="4" fill="#334155"/><path d="M30 12 L54 20 L30 26 Z" fill="#0ea5e9"/></g>`);

    const ammoFallback = getSVGDataURI(`<rect x="10" y="18" width="44" height="32" fill="#f59e0b" stroke="#b45309" stroke-width="2"/><rect x="8" y="14" width="48" height="6" fill="#d97706"/><path d="M32 24 L26 34 L32 34 L28 44 L40 28 L32 28 Z" fill="#78350f"/><rect x="10" y="46" width="44" height="4" fill="#b45309"/>`);
    const shotgunFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#9ca3af"><rect x="8" y="26" width="44" height="12" rx="2"/><rect x="40" y="22" width="12" height="20" rx="1" fill="#cbd5e1"/><rect x="14" y="24" width="8" height="16" fill="#6b7280"/></g>`);
    const rocketFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#f87171"><rect x="6" y="26" width="40" height="12" rx="2"/><rect x="38" y="22" width="12" height="20" rx="1" fill="#ef4444"/><polygon points="6,32 2,28 2,36" fill="#b91c1c"/></g>`);
    const railFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#94a3b8"><rect x="6" y="24" width="44" height="8" rx="2"/><rect x="40" y="20" width="10" height="16" rx="1" fill="#60a5fa"/><rect x="10" y="26" width="14" height="4" fill="#0ea5e9"/></g>`);
    const jetpackFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#ef4444"><rect x="22" y="16" width="20" height="32" rx="4"/><rect x="18" y="20" width="6" height="20" rx="2" fill="#94a3b8"/><rect x="40" y="20" width="6" height="20" rx="2" fill="#94a3b8"/><rect x="24" y="24" width="16" height="4" fill="#fbbf24"/></g>`);
    const grenadeFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#84cc16"><rect x="8" y="24" width="34" height="10" rx="2" fill="#4d7c0f"/><circle cx="38" cy="26" r="8"/><circle cx="38" cy="26" r="5" fill="#a3e635"/><rect x="12" y="22" width="6" height="6" fill="#1f2937"/></g>`);
    const chainsawFallback = getSVGDataURI(`<g stroke="#1f2937" stroke-width="2" fill="#ef4444"><rect x="6" y="26" width="36" height="10" rx="2"/><rect x="36" y="22" width="14" height="18" rx="2" fill="#b91c1c"/><circle cx="44" cy="31" r="6" fill="#fbbf24"/><rect x="10" y="22" width="8" height="6" fill="#111827"/></g>`);
    const intelFallback = getSVGDataURI(`<rect x="14" y="16" width="36" height="28" rx="2" fill="#facc15" stroke="#ca8a04" stroke-width="2"/><path d="M26 16 L26 12 L38 12 L38 16" stroke="#ca8a04" stroke-width="2" fill="none"/><circle cx="32" cy="30" r="4" fill="#ef4444" opacity="0.8"><animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" /></circle>`);
    const plasmaFallback = getSVGDataURI(`<g stroke="#1e40af" stroke-width="2" fill="#1e3a8a"><rect x="6" y="26" width="44" height="12" rx="2"/><rect x="40" y="24" width="8" height="16" rx="1" fill="#3b82f6"/><circle cx="16" cy="32" r="4" fill="#60a5fa"/><circle cx="26" cy="32" r="4" fill="#60a5fa"/><circle cx="36" cy="32" r="4" fill="#60a5fa"/></g>`);

    // Manifest of assets
    // For now, we mix real files and generated SVGs (as data URIs)
    const manifest = {
        [ItemType.HEALTH]: '/assets/items/health.png',
        [ItemType.ARMOR]: '/assets/items/armor_shield.png',
        [ItemType.AMMO]: '/assets/items/ammo.png',
        [ItemType.FUEL]: '/assets/items/fuel.png',
        [ItemType.FLAG]: '/assets/items/flag_base.png',
        [ItemType.INTEL]: intelFallback,
        flag_blue: '/assets/items/flag_blue.png',
        flag_red: '/assets/items/flag_red.png',
        weapon_shotgun: '/assets/items/shotgun.png',
        weapon_rocket_launcher: '/assets/items/rocketlunch.png',
        weapon_railgun: '/assets/items/railgun.png',
        weapon_machine_gun: '/assets/items/machinegun.png',
        weapon_grenade_launcher: '/assets/items/granat.png',
        weapon_chainsaw: '/assets/items/chainsaw.png',
        weapon_plasma_gun: '/assets/items/plasma_gun.png',
        jetpack: '/assets/items/jetpack.png',
        dirt_tile: '/assets/dirt_tile.png',
        grass_tile: '/assets/grass_tile.png'
    };

    // Bump bundle name to force reload when manifest changes
    const bundleName = 'game-assets-v11';
    const fallbackBundleName = 'game-assets-v10-fallback';

    try {
        // Check if bundle already exists to avoid duplicate error
        if (!Assets.cache.has(bundleName)) {
            Assets.addBundle(bundleName, manifest);
        }

        const textures = await Assets.loadBundle(bundleName);
        if (!textures[ItemType.ARMOR]) {
            textures[ItemType.ARMOR] = Texture.from(armorFallback);
        }
        if (!textures[ItemType.AMMO]) textures[ItemType.AMMO] = Texture.from(ammoFallback);
        if (!textures[ItemType.FUEL]) textures[ItemType.FUEL] = Texture.from(fuelFallback);
        if (!textures[ItemType.FLAG]) textures[ItemType.FLAG] = Texture.from(flagFallback);
        if (!textures[ItemType.INTEL]) textures[ItemType.INTEL] = Texture.from(intelFallback);
        if (!textures.flag_blue) textures.flag_blue = Texture.from(flagFallback);
        if (!textures.flag_red) textures.flag_red = Texture.from(flagFallback);
        if (!textures.weapon_shotgun) textures.weapon_shotgun = Texture.from(shotgunFallback);
        if (!textures.weapon_rocket_launcher) textures.weapon_rocket_launcher = Texture.from(rocketFallback);
        if (!textures.weapon_railgun) textures.weapon_railgun = Texture.from(railFallback);
        if (!textures.weapon_grenade_launcher) textures.weapon_grenade_launcher = Texture.from(grenadeFallback);
        if (!textures.weapon_chainsaw) textures.weapon_chainsaw = Texture.from(chainsawFallback);
        if (!textures.weapon_plasma_gun) textures.weapon_plasma_gun = Texture.from(plasmaFallback);
        if (!textures.jetpack) textures.jetpack = Texture.from(jetpackFallback);
        return textures;
    } catch (e) {
        console.error("Failed to load assets, falling back for item sprites:", e);

        const fallbackManifest = {
            ...manifest,
            [ItemType.ARMOR]: armorFallback,
            [ItemType.AMMO]: ammoFallback,
            [ItemType.FUEL]: fuelFallback,
            [ItemType.FLAG]: flagFallback,
            [ItemType.INTEL]: intelFallback,
            flag_blue: flagFallback,
            flag_red: flagFallback,
            weapon_shotgun: shotgunFallback,
            weapon_rocket_launcher: rocketFallback,
            weapon_railgun: railFallback,
            weapon_grenade_launcher: grenadeFallback,
            weapon_chainsaw: chainsawFallback,
            weapon_plasma_gun: plasmaFallback,
            jetpack: jetpackFallback
        };
        if (!Assets.cache.has(fallbackBundleName)) {
            Assets.addBundle(fallbackBundleName, fallbackManifest);
        }

        try {
            return await Assets.loadBundle(fallbackBundleName);
        } catch (err) {
            console.error("Failed to load fallback assets:", err);
            return {};
        }
    }
};

// Optional: Clear cache if needed (e.g., for hot reload during development)
export const clearAssetsCache = () => {
    cachedTextures = null;
    loadingPromise = null;
};
