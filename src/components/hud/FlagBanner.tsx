// Objective banner under the team score: a big team-coloured line on a dark band that drops in,
// holds and fades (CSS `hb-banner`). Keyed by the event id, so a newer event replaces it at once.

import React from 'react';
import type { Translate } from '../menu/types';
import { FlagBannerEvent, flagBannerColor, flagBannerText } from './flagBannerText';

const BAND = 'linear-gradient(90deg, transparent, rgba(14,17,22,0.72) 18%, rgba(14,17,22,0.72) 82%, transparent)';

export const FlagBanner: React.FC<{ t: Translate; banner: FlagBannerEvent | null }> = ({ t, banner }) => {
    const text = banner && flagBannerText(t, banner);
    if (!banner || !text) return null;
    return (
        <div className="pointer-events-none absolute inset-x-0 top-[168px] z-40 flex justify-center px-4">
            <span key={banner.id} role="status" className="hb-banner px-16 py-1.5 text-center font-display text-[40px] font-black uppercase leading-none tracking-wide sm:text-[60px]"
                style={{ color: flagBannerColor(banner), background: BAND, WebkitTextStroke: '1.5px #0E1116', paintOrder: 'stroke fill', textShadow: '0 3px 0 rgba(0,0,0,0.6)' }}>
                {text}
            </span>
        </div>
    );
};
