// Phone controls on screen: the two sticks (resting at the bottom corners, following the thumb
// once it lands) and the hook button left of the aim stick. Input itself is read on the canvas
// (game/input/touchSticks); this only draws it.

import React from 'react';
import { AIM_STICK_RADIUS, deflection, FIRE_THRESHOLD, isFiring, RUN_THRESHOLD, Stick, STICK_RADIUS } from '../../../game/input/sticks';
import type { TouchSticksState } from '../../../game/input/touchSticks';
import type { Translate } from '../../menu/types';

const RING = 92; // px
const KNOB = 34;
const KNOB_TRAVEL = RING / 2 - 2 - KNOB / 2; // knob centre at the rim when the stick is fully pushed

const EdgeCircle: React.FC<{ share: number; color: string }> = ({ share, color }) => {
    const r = share * KNOB_TRAVEL;
    return <div className={`absolute rounded-full border border-dashed ${color}`} style={{ width: 2 * r, height: 2 * r, left: RING / 2 - 2 - r, top: RING / 2 - 2 - r }} />;
};

const Ring: React.FC<{ stick: Stick | null; side: 'move' | 'aim' }> = ({ stick, side }) => {
    const radius = side === 'aim' ? AIM_STICK_RADIUS : STICK_RADIUS;
    const d = stick ? deflection(stick, radius) : { x: 0, y: 0, amount: 0 };
    const firing = side === 'aim' && !!stick && isFiring(d);
    // Resting rings sit in the corners; a live one is centred where the thumb landed
    const place: React.CSSProperties = stick
        ? { left: stick.originX - RING / 2, top: stick.originY - RING / 2 }
        : side === 'move' ? { left: 34, bottom: 20 } : { right: 34, bottom: 20 };
    const ring = side === 'aim'
        ? (firing ? 'border-bay-hazard bg-bay-hazard/25' : 'border-bay-hazard/60 bg-bay-deep/25')
        : 'border-bay-chalk/30 bg-bay-deep/25';
    const knob = side === 'aim' ? 'bg-bay-hazard/80' : 'bg-bay-chalk/55';
    return (
        <div aria-hidden="true" className={`pointer-events-none absolute z-30 rounded-full border-2 ${ring} ${stick ? '' : 'opacity-60'}`}
            style={{ ...place, width: RING, height: RING }}>
            {/* Inside the dashed circle the move stick walks and the aim stick only aims; at the edge they run and fire */}
            <EdgeCircle share={side === 'aim' ? FIRE_THRESHOLD : RUN_THRESHOLD} color={side === 'aim' ? 'border-bay-hazard/50' : 'border-bay-chalk/35'} />
            <div className={`absolute rounded-full ${knob}`} style={{
                width: KNOB, height: KNOB,
                left: KNOB_TRAVEL + d.x * KNOB_TRAVEL,
                top: KNOB_TRAVEL + d.y * KNOB_TRAVEL,
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
