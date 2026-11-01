// Bottom-left HUD block: health, armor and jetpack fuel as three aligned rows (icon, number, bar).

import React, { useEffect, useRef, useState } from 'react';
import { ITEM_ICON, PANEL } from './hudIcons';
import type { Translate } from '../menu/types';

const SEGMENTS = 10;

const SegmentBar: React.FC<{ percent: number; color: string; height: number }> = ({ percent, color, height }) => {
    const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * SEGMENTS);
    return (
        <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}>
            {Array.from({ length: SEGMENTS }, (_, i) => (
                <span key={i} style={{ height, background: i < filled ? color : '#3C434D' }} />
            ))}
        </div>
    );
};

interface Props {
    t: Translate;
    hp: number;
    armor: number;
    fuel: number;
    maxFuel: number;
}

export const Vitals: React.FC<Props> = ({ t, hp, armor, fuel, maxFuel }) => {
    // Brief "+25" when health goes up (pickups)
    const previousHp = useRef(hp);
    const [gain, setGain] = useState<number | null>(null);
    useEffect(() => {
        const diff = hp - previousHp.current;
        previousHp.current = hp;
        if (diff <= 0 || hp <= diff) return; // ignore respawn from 0
        setGain(diff);
        const timer = setTimeout(() => setGain(null), 1500);
        return () => clearTimeout(timer);
    }, [hp]);

    const fuelPercent = Math.round((fuel / (maxFuel || 100)) * 100);
    const low = hp <= 25;

    return (
        <div className={`${PANEL} pointer-events-none absolute bottom-8 left-8 z-40 grid w-[360px] grid-cols-[36px_84px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-[18px] py-3.5`}>
            {gain !== null && (
                <span className="absolute -top-9 left-4 animate-[float_1.5s_ease-out_forwards] font-display text-3xl font-black text-green-400">+{gain}</span>
            )}
            <img src={ITEM_ICON.health} alt={t('hud.health')} className="h-9 w-9 justify-self-center object-contain" />
            <span className={`font-display text-[52px] font-black leading-[0.9] ${low ? 'text-bay-signal' : ''}`}>{Math.max(0, hp)}</span>
            <SegmentBar percent={hp} color={low ? '#FF4D2E' : '#ECE9E2'} height={14} />

            <img src={ITEM_ICON.armor} alt={t('hud.armor')} className="h-9 w-9 justify-self-center object-contain" />
            <span className="font-display text-3xl font-black leading-none text-blue-300">{Math.round(armor)}</span>
            <SegmentBar percent={armor} color="#60A5FA" height={8} />

            <img src={ITEM_ICON.fuel} alt={t('hud.fuel')} className="h-9 w-9 justify-self-center object-contain" />
            <span className="font-display text-3xl font-black leading-none text-bay-hazard">{fuelPercent}%</span>
            <div aria-hidden="true" className="h-2 bg-bay-plate">
                <div className="fuel-stripes h-2 transition-[width] duration-200" style={{ width: `${Math.min(100, fuelPercent)}%` }} />
            </div>
        </div>
    );
};
