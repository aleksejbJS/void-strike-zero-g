// Magazine-fed weapons (the Machine Gun): a limited magazine, an unlimited reserve and an
// automatic reload once the magazine is empty. The reload runs on the weapon itself, so it
// keeps going in the background after the fighter switches to another weapon.

import { Entity, Weapon } from '../../types';
import { gameEvents } from './events';

export const isMagazineFed = (w: Weapon): boolean => (w.reloadMs ?? 0) > 0;

export const isReloading = (w: Weapon): boolean => w.reloadEndsAt !== undefined;

/** True when the weapon has a round ready: ammo left and no reload running. */
export const canFire = (w: Weapon): boolean => w.ammo > 0 && !isReloading(w);

/** Starts the reload of an empty magazine-fed weapon (no-op for any other weapon). */
export const startReloadIfEmpty = (w: Weapon, now: number): void => {
    if (!isMagazineFed(w) || isReloading(w) || w.ammo > 0) return;
    w.reloadEndsAt = now + (w.reloadMs ?? 0);
    gameEvents.emit({ type: 'SOUND', sound: 'reload', subtype: w.type }); // heard like shots are
};

const tickReload = (w: Weapon, now: number): void => {
    if (!isMagazineFed(w)) return;
    if (w.reloadEndsAt !== undefined) {
        if (now < w.reloadEndsAt) return;
        w.ammo = w.maxAmmo;
        delete w.reloadEndsAt;
        return;
    }
    startReloadIfEmpty(w, now);
};

/** Every carried weapon: empty magazines start reloading, finished reloads refill the magazine. */
export const tickReloads = (p: Pick<Entity, 'weapon' | 'inventory'>, now: number): void => {
    // The held weapon is normally one of the inventory objects; the set visits it once
    for (const w of new Set([p.weapon, ...p.inventory])) tickReload(w, now);
};

/** How far the running reload is, 0..1, or null when the weapon is not reloading. */
export const reloadProgress = (w: Weapon, now: number): number | null => {
    if (w.reloadEndsAt === undefined || !isMagazineFed(w)) return null;
    const total = w.reloadMs ?? 0;
    const left = w.reloadEndsAt - now;
    return Math.max(0, Math.min(1, 1 - left / total));
};
