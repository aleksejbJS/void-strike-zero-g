// Who sees the "Ad settings" button in the menu: the owner, not players.
// Visible in a local dev build, or in a browser that once opened the game with ?admin=1
// (?admin=0 forgets it). The settings page itself saves nothing for players, so this only
// keeps a service button out of their menu.

const KEY = 'void-strike.admin';

export const rememberAdminFlag = (search: string) => {
    const value = new URLSearchParams(search).get('admin');
    if (value !== '1' && value !== '0') return;
    try {
        if (value === '1') localStorage.setItem(KEY, '1');
        else localStorage.removeItem(KEY);
    } catch (err) {
        console.warn('Could not remember the admin flag in this browser', err);
    }
};

export const canSeeAdSettings = () => {
    if (import.meta.env.DEV) return true;
    try {
        return localStorage.getItem(KEY) === '1';
    } catch (err) {
        console.warn('Could not read the admin flag', err);
        return false;
    }
};

export const ADS_ADMIN_HASH = '#ads-admin';
