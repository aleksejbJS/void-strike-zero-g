// Touch controls overlay: joystick ring (driven by GameCanvas touch handlers), jetpack and hook buttons.

import React from 'react';
import { PANEL } from './hudIcons';
import type { Translate } from '../menu/types';

export interface Joystick {
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface Props {
    t: Translate;
    joystick: Joystick | null;
    jumpDown: boolean;
    hookDown: boolean;
    onJump: (down: boolean) => void;
    onHook: (down: boolean) => void;
}

const touchButton = (down: boolean) =>
    `flex h-16 w-16 items-center justify-center rounded-full border-2 font-display text-lg font-black ${down ? 'scale-95 border-bay-hazard bg-bay-hazard text-bay-ink' : 'border-bay-edge bg-bay-ink/80 text-bay-chalk'}`;

export const MobileControls: React.FC<Props> = ({ t, joystick, jumpDown, hookDown, onJump, onHook }) => (
    <>
        {joystick?.active && (
            <div aria-hidden="true" className="pointer-events-none absolute h-24 w-24 rounded-full border-2 border-bay-hazard/60"
                style={{ left: joystick.startX - 48, top: joystick.startY - 48 }}>
                <div className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bay-hazard/80"
                    style={{ left: joystick.currentX - joystick.startX + 48, top: joystick.currentY - joystick.startY + 48 }} />
            </div>
        )}
        <div className="absolute bottom-[230px] right-4 z-50 flex flex-col gap-3">
            <button type="button" aria-label={t('hud.jump')} className={touchButton(jumpDown)}
                onTouchStart={() => onJump(true)} onTouchEnd={() => onJump(false)}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
            <button type="button" aria-label={t('hud.hook')} className={touchButton(hookDown)}
                onTouchStart={() => onHook(true)} onTouchEnd={() => onHook(false)}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v11a4 4 0 11-4-4M12 3l-3 3M12 3l3 3" /></svg>
            </button>
        </div>
        <div className={`${PANEL} pointer-events-none absolute left-4 top-[200px] z-40 max-w-[220px] p-3 text-xs text-bay-dust`}>
            <div className="mb-1 font-semibold text-bay-chalk">{t('hud.mobileTitle')}</div>
            <div>{t('hud.mobileMove')}</div>
            <div>{t('hud.mobileAim')}</div>
            <div>{t('hud.mobileButtons')}</div>
        </div>
    </>
);
