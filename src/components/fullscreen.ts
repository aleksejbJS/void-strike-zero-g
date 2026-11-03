// Full screen on phones: the browser bar hides while a match runs. Browsers allow entering it only
// from a tap, so the match's Start button and the HUD button call `enterFullscreen`. iPhones do
// not let pages go full screen at all; there every call is a no-op.

import { useEffect, useState } from 'react';

/** Phones and tablets (and very narrow windows): they get the touch HUD and full screen. */
export const isTouchDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

export const canFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenEnabled;

const isFullscreen = () => !!document.fullscreenElement;

// `screen.orientation.lock` is missing from the DOM typings in some TS versions
type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

export const enterFullscreen = async (): Promise<void> => {
    if (!canFullscreen() || isFullscreen()) return;
    try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
        console.warn('Could not enter full screen:', err);
        return;
    }
    // Keep the phone sideways while playing; browsers that refuse the lock still play fine
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) return;
    try {
        await orientation.lock('landscape');
    } catch (err) {
        console.warn('Could not lock the screen to landscape:', err);
    }
};

export const exitFullscreen = async (): Promise<void> => {
    if (!isFullscreen()) return;
    try {
        await document.exitFullscreen();
    } catch (err) {
        console.warn('Could not leave full screen:', err);
    }
};

/** Whether the page is full screen now, following changes made by the browser too (swipe, back). */
export const useFullscreen = () => {
    const [active, setActive] = useState(isFullscreen);
    useEffect(() => {
        const onChange = () => setActive(isFullscreen());
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    return { supported: canFullscreen(), active, toggle: () => (active ? exitFullscreen() : enterFullscreen()) };
};
