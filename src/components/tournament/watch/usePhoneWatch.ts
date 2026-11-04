// Watching on a phone: the `phone:` breakpoint (a touch device at most 500 px tall) shows one tile,
// and a horizontal swipe switches between the watched matches.

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { isTouchDevice } from '../../fullscreen';
import { swipeStep } from './watchLayout';

/** Same height limit as the `phone:` screen in index.html's Tailwind config. */
const PHONE_MAX_HEIGHT = 500;

const isPhoneScreen = () => isTouchDevice() && window.innerHeight <= PHONE_MAX_HEIGHT;

/** True on a phone-sized touch screen; follows rotation and resizes. */
export const useIsPhone = (): boolean => {
    const [phone, setPhone] = useState(isPhoneScreen);
    useEffect(() => {
        const update = () => setPhone(isPhoneScreen());
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return phone;
};

interface SwipeHandlers {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

/** Touch handlers that call `onStep(+1)` for a swipe to the left and `onStep(-1)` for one to the right. */
export const useSwipe = (onStep: (step: 1 | -1) => void): SwipeHandlers => {
    const start = useRef<{ x: number; y: number } | null>(null);
    return {
        onTouchStart: (e) => {
            const touch = e.touches[0];
            start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        },
        onTouchEnd: (e) => {
            const from = start.current;
            const touch = e.changedTouches[0];
            start.current = null;
            if (!from || !touch) return;
            const dx = touch.clientX - from.x;
            if (Math.abs(touch.clientY - from.y) > Math.abs(dx)) return; // a vertical drag is not a swipe
            const step = swipeStep(dx);
            if (step !== 0) onStep(step);
        },
    };
};
