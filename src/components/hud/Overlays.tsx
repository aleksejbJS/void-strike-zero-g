// Full-screen and banner overlays: death screen, connection status, invite link, debug stats.

import React, { useState } from 'react';
import { PANEL } from './hudIcons';
import type { Translate } from '../menu/types';

export const DeathOverlay: React.FC<{ t: Translate; respawnMs: number }> = ({ t, respawnMs }) => (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[rgba(14,17,22,0.75)]">
        <div className="flex flex-col items-center gap-3">
            <div aria-hidden="true" className="hazard-stripes h-3 w-[420px] max-w-[80vw] phone:h-2 phone:w-[240px]" />
            <span className="font-display text-[88px] font-black uppercase leading-none text-bay-signal phone:text-5xl">{t('hud.youDied')}</span>
            <span className="font-body text-2xl text-bay-chalk phone:text-base">{t('hud.respawnIn', Math.max(0, respawnMs / 1000).toFixed(1))}</span>
        </div>
    </div>
);

interface ConnectionProps { t: Translate; error: string | null; inTournament?: boolean; reconnecting?: boolean }

export const ConnectionOverlay: React.FC<ConnectionProps> = ({ t, error, inTournament, reconnecting }) => (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
        <div role={error ? 'alert' : 'status'} className={`${PANEL} max-w-md px-6 py-4 text-center font-body`}>
            <div className={error ? 'font-semibold text-bay-signal' : ''}>{error ?? t(reconnecting ? 'tournament.match.reconnecting' : 'net.connecting')}</div>
            {error && <div className="mt-2 text-sm text-bay-dust">{t(inTournament ? 'tournament.net.backToBracket' : 'net.backToMenu')}</div>}
        </div>
    </div>
);

/** A tournament duel after the first Esc: a second one within 2 s forfeits the match. */
export const ForfeitHint: React.FC<{ t: Translate }> = ({ t }) => (
    <div className="pointer-events-none absolute left-1/2 top-24 z-[60] -translate-x-1/2">
        <div role="alert" className={`${PANEL} px-5 py-2 font-display text-lg font-extrabold uppercase text-bay-hazard`}>
            {t('tournament.match.forfeitHint')}
        </div>
    </div>
);

export const InviteBanner: React.FC<{ t: Translate; link: string; onClose: () => void }> = ({ t, link, onClose }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(link)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
            .catch(err => console.warn('Copy failed:', err));
    };
    return (
        <div className={`${PANEL} absolute left-1/2 top-24 z-50 flex max-w-[90vw] phone:top-10 phone:py-2 -translate-x-1/2 flex-col gap-2 px-4 py-3 font-body`}>
            <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xl font-extrabold phone:text-base">{t('hud.invite')}</span>
                <button type="button" onClick={onClose} aria-label={t('hud.close')}
                    className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded text-bay-dust hover:bg-bay-steel hover:text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>
            <div className="flex items-center gap-2">
                <code className="min-w-0 truncate rounded bg-bay-steel px-2.5 py-2 text-sm">{link}</code>
                <button type="button" onClick={copy}
                    className="h-10 shrink-0 rounded bg-bay-hazard px-3.5 text-sm font-semibold text-bay-ink hover:bg-[#FFD24D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-chalk">
                    {copied ? t('hud.copied') : t('hud.copy')}
                </button>
            </div>
            <span className="text-[13px] text-bay-dust">{t('hud.waiting')}</span>
        </div>
    );
};

export const DebugStats: React.FC<{ fps: number; tps: number }> = ({ fps, tps }) => (
    <div className="pointer-events-none absolute bottom-[230px] left-8 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-green-300">
        FPS {fps} · physics {tps}/s
    </div>
);
