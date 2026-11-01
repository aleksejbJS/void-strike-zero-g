// Building blocks for the menu's schematic mode previews:
// a fixed 620×340 stage scaled to its column, platforms, player figures and badges.

import React, { useEffect, useRef, useState } from 'react';

export const STAGE_W = 620;
export const STAGE_H = 340;

export const COLORS = {
    blue: '#3B82F6',
    red: '#EF4444',
    green: '#22C55E',
    you: '#ECE9E2',
    head: '#F59E0B',
    redHead: '#FCA5A5',
    hazard: '#FFC21A',
};

/** Fixed-size scene, scaled down to fit narrower columns (e.g. on phones). */
export const Stage: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
    const outer = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const el = outer.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / STAGE_W)));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={outer} role="img" aria-label={label}
            className="relative w-full overflow-hidden rounded border-2 border-bay-plate bg-bay-deep"
            style={{ height: STAGE_H * scale }}>
            <div aria-hidden="true" className="absolute left-0 top-0 origin-top-left"
                style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
                <Platforms />
                {children}
            </div>
        </div>
    );
};

const Platforms: React.FC = () => (
    <>
        <div className="absolute inset-x-0 bg-bay-steel border-t-4 border-bay-edge" style={{ top: 300, height: 40 }} />
        <div className="absolute hazard-platform" style={{ left: 40, top: 214, width: 160, height: 16 }} />
        <div className="absolute hazard-platform" style={{ left: 420, top: 214, width: 160, height: 16 }} />
        <div className="absolute hazard-platform" style={{ left: 220, top: 134, width: 180, height: 16 }} />
    </>
);

interface FigureProps {
    x: number;
    y: number;
    body: string;
    head?: string;
    label?: string;
    labelColor?: string;
    flame?: boolean;
    carry?: string;      // color of a carried flag
    intel?: boolean;     // carries the intel case
    animation?: string;  // CSS animation shorthand (keyframes in hazard.css)
}

/** A player as drawn in the previews: head, torso, optional jetpack flame and carried item. */
export const Figure: React.FC<FigureProps> = ({ x, y, body, head = COLORS.head, label, labelColor = COLORS.hazard, flame, carry, intel, animation }) => (
    <div className={`absolute flex flex-col items-center ${animation ? 'hb-anim' : ''}`} style={{ left: x, top: y, animation }}>
        {label && <span className="mb-0.5 text-[11px] font-semibold" style={{ color: labelColor }}>{label}</span>}
        {intel && <div className="mb-0.5 h-2.5 w-3.5 rounded-sm bg-bay-hazard" />}
        <div className="flex items-start">
            <div className="h-3 w-3 rounded-full" style={{ background: head }} />
            {carry && <><div className="ml-0.5 h-[26px] w-0.5 bg-bay-dust" /><div className="h-2.5 w-4" style={{ background: carry }} /></>}
        </div>
        <div className="h-5 w-3 rounded-[3px]" style={{ background: body, marginTop: carry ? -14 : 0, marginRight: carry ? 18 : 0 }} />
        {flame && <div className="h-3.5 w-1.5 rounded-b-md bg-bay-hazard" style={{ marginRight: carry ? 18 : 0 }} />}
    </div>
);

/** A short streak that flies out and fades (a bullet). */
export const Tracer: React.FC<{ x: number; y: number; color: string; dir: 'r' | 'l'; duration: string; delay?: string }> = ({ x, y, color, dir, duration, delay = '0s' }) => (
    <div className="hb-anim absolute h-0.5 w-11" style={{ left: x, top: y, background: color, animation: `hb-tracer-${dir} ${duration} linear ${delay} infinite` }} />
);

/** Floating "+1" style pop-up. */
export const Pop: React.FC<{ x: number; y: number; text: string; duration: string }> = ({ x, y, text, duration }) => (
    <div className="hb-anim absolute font-display text-[22px] font-black text-bay-hazard" style={{ left: x, top: y, animation: `hb-pop ${duration} ease-out infinite` }}>{text}</div>
);

/** Dark info box pinned inside the stage. */
export const Badge: React.FC<{ pos: React.CSSProperties; children: React.ReactNode }> = ({ pos, children }) => (
    <div className="absolute rounded-sm bg-bay-ink/90 px-2.5 py-1.5 text-[13px] text-bay-chalk" style={pos}>{children}</div>
);

/** Flag on a pole standing in a base. */
export const BaseFlag: React.FC<{ x: number; color?: string }> = ({ x, color }) => (
    <>
        <div className="absolute w-[3px] bg-bay-dust" style={{ left: x, top: 252, height: 48 }} />
        {color && <div className="absolute h-4 w-[26px]" style={{ left: x + 3, top: 252, background: color }} />}
    </>
);
