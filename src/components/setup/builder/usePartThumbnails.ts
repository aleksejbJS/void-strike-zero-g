// Pictures for one slot's tiles, redrawn 150 ms after the build or colours settle. Empty until the first
// pictures are ready, and empty for good if Pixi fails, so the tiles fall back to their names.

import { useEffect, useRef, useState } from 'react';
import { FighterBuild, Slot } from '../../../game/build/buildParts';
import { SetupColors } from '../../../game/render/fighter/fighterLook';
import { acquireThumbnails, releaseThumbnails, renderThumbnails } from './thumbnailRenderer';

const DEBOUNCE_MS = 150;
const CACHE_SIZE = 24;

// Recent pictures by input, so going back to a tab shows them at once
const cache = new Map<string, Record<string, string>>();

const remember = (key: string, thumbs: Record<string, string>) => {
    cache.delete(key);
    cache.set(key, thumbs);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
};

/** Everything the pictures depend on. The slot's own pick is left out: every tile overrides it. */
const inputKey = (slot: Slot, base: FighterBuild, colors: SetupColors) =>
    JSON.stringify([slot, { ...base, [slot]: '' }, colors.head, colors.torso, colors.arms, colors.legs, colors.jetpack]);

export const usePartThumbnails = (slot: Slot, base: FighterBuild, colors: SetupColors): Record<string, string> => {
    const key = inputKey(slot, base, colors);
    const [thumbs, setThumbs] = useState<Record<string, string>>(() => cache.get(key) ?? {});
    const latest = useRef({ slot, base, colors });
    latest.current = { slot, base, colors };

    useEffect(() => {
        acquireThumbnails();
        return releaseThumbnails;
    }, []);

    useEffect(() => {
        const cached = cache.get(key);
        if (cached) {
            setThumbs(cached);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            const { slot: s, base: b, colors: c } = latest.current;
            renderThumbnails(s, b, c)
                .then(result => {
                    remember(key, result);
                    if (!cancelled) setThumbs(result);
                })
                .catch(err => {
                    console.warn(`Part thumbnails for "${s}" failed; tiles show names only`, err);
                    if (!cancelled) setThumbs({});
                });
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [key]);

    return thumbs;
};
