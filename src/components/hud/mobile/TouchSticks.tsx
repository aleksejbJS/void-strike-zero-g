// Phone controls on screen: the two sticks (resting at the bottom corners, following the thumb
// once it lands) and the hook button left of the aim stick. Input itself is read on the canvas
// (game/input/touchSticks); this only draws it.

import React from 'react';
import { deflection, isFiring, Stick, STICK_RADIUS } from '../../../game/input/sticks';
import type { TouchSticksState } from '../../../game/input/touchSticks';
import type { Translate } from '../../menu/types';

const RING = 92; // px
const KNOB = 34;

const Ring: React.FC<{ stick: Stick | null; side: 'move' | 'aim' }> = ({ stick, side }) => {
    const firing = side === 'aim' && !!stick && isFiring(deflection(stick));
    const d = stick ? deflection(stick) : { x: 0, y: 0 };
    // Resting rings sit in the corners; a live one is centred where the thumb landed
    const place: React.CSSProperties = stick
        ? { left: stick.originX - RING / 2, top: stick.originY - RING / 2 }
        : side === 'move' ? { left: 34, bottom: 20 } : { right: 34, bottom: 20 };
    const ring = side === 'aim' ? (firing ? 'border-bay-hazard' : 'border-bay-hazard/60') : 'border-bay-chalk/30';
    const knob = side === 'aim' ? 'bg-bay-hazard/80' : 'bg-bay-chalk/55';
    return (
        <div aria-hidden="true" className={`pointer-events-none absolute z-30 rounded-full border-2 bg-bay-deep/25 ${ring} ${stick ? '' : 'opacity-60'}`}
            style={{ ...place, width: RING, height: RING }}>
            <div className={`absolute rounded-full ${knob}`} style={{
                width: KNOB, height: KNOB,
                left: RING / 2 - 2 - KNOB / 2 + d.x * STICK_RADIUS * 0.6,
                top: RING / 2 - 2 - KNOB / 2 + d.y * STICK_RADIUS * 0.6,
            }} />
        </div>
    );
};

interface Props {
    t: Translate;
    sticks: TouchSticksState;
    hookDown: boolean;
    onHook: (down: boolean) => void;
}

export const TouchSticks: React.FC<Props> = ({ t, sticks, hookDown, onHook }) => (
    <>
        <Ring stick={sticks.move} side="move" />
        <Ring stick={sticks.aim} side="aim" />
        <button type="button" aria-label={t('hud.hook')} aria-pressed={hookDown}
            onTouchStart={() => onHook(true)} onTouchEnd={() => onHook(false)} onTouchCancel={() => onHook(false)}
            className={`absolute bottom-[30px] right-[140px] z-40 flex h-10 w-10 items-center justify-center rounded-full border-2 ${hookDown ? 'scale-95 border-bay-hazard bg-bay-hazard text-bay-ink' : 'border-bay-chalk/35 bg-bay-deep/35 text-bay-chalk'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v11a4 4 0 11-4-4M12 3l-3 3M12 3l3 3" />
            </svg>
        </button>
    </>
);
