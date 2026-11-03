// URLs for files in public/ that work wherever the site is served: the dev server at "/",
// GitHub Pages under "/void-strike-zero-g/". Vite's base is "./", so a path starting with "/"
// would point at the domain root and miss the game's folder.

const BASE: string = import.meta.env?.BASE_URL ?? '/';

export const assetUrl = (path: string) => `${BASE}${path.replace(/^\/+/, '')}`;
