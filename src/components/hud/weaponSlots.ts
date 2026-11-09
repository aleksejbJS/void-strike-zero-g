// Weapon slots the player can pick: one per weapon type, keys 1–9 on the keyboard.

/** Most slots the weapon bar shows and the keys reach: every weapon type fits in one. */
export const MAX_WEAPON_SLOTS = 9;

/** The slot index (0-based) a key picks: '1'…'9' → 0…8, any other key → null. */
export const weaponSlotOfKey = (key: string): number | null => {
    if (!/^[1-9]$/.test(key)) return null;
    const slot = Number(key) - 1;
    return slot < MAX_WEAPON_SLOTS ? slot : null;
};
