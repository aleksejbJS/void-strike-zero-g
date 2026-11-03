// How the touch controls work, shown for a few seconds at the start of the first matches
// on this device, then never again.

import React, { useEffect, useState } from 'react';
import type { Translate } from '../../menu/types';

const SEEN_KEY = 'touchHintMatches';
const SHOW_IN_MATCHES = 3;
const SHOW_MS = 6000;

/** Counts this match and says whether the hint is still due. Storage can be blocked: then always show. */
const takeHintTurn = (): boolean => {
    try {
        const seen = Number(localStorage.getItem(SEEN_KEY)) || 0;
        if (seen >= SHOW_IN_MATCHES) return false;
        localStorage.setItem(SEEN_KEY, String(seen + 1));
        return true;
    } catch (err) {
        console.warn(`Could not read "${SEEN_KEY}" from storage, showing the touch hint:`, err);
        return true;
    }
};

export const TouchHint: React.FC<{ t: Translate }> = ({ t }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!takeHintTurn()) return;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), SHOW_MS);
        return () => clearTimeout(timer);
    }, []);
    if (!visible) return null;
    return (
        <div role="status" className="pointer-events-none absolute left-1/2 top-14 z-40 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded bg-bay-deep/70 px-3 py-1.5 text-center text-[11px] text-bay-chalk">
            <span className="font-semibold text-bay-hazard">{t('hud.mobileTitle')}</span>
            <span>{t('hud.touchMove')}</span>
            <span>{t('hud.touchAim')}</span>
            <span>{t('hud.touchWeapons')}</span>
        </div>
    );
};
