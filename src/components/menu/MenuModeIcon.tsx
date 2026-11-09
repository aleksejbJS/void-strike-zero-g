// Solid stencil emblems following the approved menu artwork, rather than outline UI glyphs.
import React, { useId } from 'react';
import { GameMode } from '../../types';

export type MenuEmblem = GameMode | 'crosshair' | 'camera' | 'pin';

const flag = <path d="M15 8c14-8 19 12 36 4l-6 25c-15 8-22-10-36-4ZM12 5a2 2 0 0 1 4 1L6 58a2 2 0 0 1-4-1Z" />;

const symbols: Partial<Record<MenuEmblem, React.ReactNode>> = {
    camera: <>
        <path fillRule="evenodd" d="M19 4a13 13 0 1 0 0 26 13 13 0 0 0 0-26Zm0 7a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM44 3a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
        <path d="M8 29h37v28H8zM46 36l16-9v31l-16-9ZM20 56h10v7H20z" />
    </>,
    pin: <path fillRule="evenodd" d="M32 3C19 3 10 13 10 25c0 14 22 37 22 37s22-23 22-37C54 13 45 3 32 3Zm0 12a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z" />,
    [GameMode.DEATHMATCH]: <path fillRule="evenodd" d="M32 5C17 5 6 14 6 28c0 9 5 15 13 18l2 11h6l1-9h3v10h5V48h3l1 9h6l1-11c8-3 12-10 12-18C59 14 47 5 32 5ZM15 31c0-4 2-6 6-6s7 2 7 6-3 7-7 7c-3 0-6-3-6-7Zm22 0c0-4 2-6 6-6s6 2 6 6c0 4-3 7-6 7s-6-3-6-7ZM32 38l-5 8h10Z" />,
    [GameMode.GUN_GAME]: <path fillRule="evenodd" d="M9 17h43l1-3h5v10h-3v6H28l-2 9-7 2-5 14H3l8-24H5v-8h4Zm18 14h11l-3 6h-8Zm3 2-.4 2h3.7l1-2ZM14 39l-4 12h3l4-12Z" />,
    [GameMode.CTF]: <g transform="translate(5 1)">{flag}</g>,
    [GameMode.HOLD_THE_FLAG]: <>
        <path d="M18 9C12 14 9 16 2 17l10 20c7-3 13-6 19-7Z" />
        <path d="M17 6 46 58" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <g transform="translate(64 0) scale(-1 1)">
            <path d="M18 9C12 14 9 16 2 17l10 20c7-3 13-6 19-7Z" />
            <path d="M17 6 46 58" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </g>
    </>,
    [GameMode.INFILTRATION]: <>
        <path fillRule="evenodd" d="M32 3C22 9 14 11 4 13l3 20c3 14 14 23 25 29 12-6 23-15 26-29l3-20C50 11 42 9 32 3Zm0 6c-8 5-15 7-22 8l3 16c3 11 11 19 19 24 9-5 17-13 20-24l3-16c-8-1-15-3-23-8Z" />
        <path d="M32 15c-6 3-11 5-16 6l2 11c2 8 7 14 14 19Z" />
    </>,
    [GameMode.HUNGER_GAMES]: <path fillRule="evenodd" d="M17 9h9V6h13v3h9v5h12v12c0 10-7 15-17 15-2 4-5 7-8 8v6h12v5H18v-5h12v-6c-3-1-6-4-8-8C12 41 5 36 5 26V14h12Zm0 10h-7v7c0 6 4 9 10 10l-2-9Zm31 0-1 8-2 9c6-1 10-4 10-10v-7Z" />,
    crosshair: <>
        <path fillRule="evenodd" d="M32 8a24 24 0 1 0 0 48 24 24 0 0 0 0-48Zm0 5a19 19 0 1 1 0 38 19 19 0 0 1 0-38Z" />
        <path d="M29 0h6v22h-6ZM29 42h6v22h-6ZM0 29h22v6H0ZM42 29h22v6H42Z" />
        <circle cx="32" cy="32" r="5" />
    </>,
};

export const MenuModeIcon: React.FC<{ emblem: MenuEmblem; className?: string }> = ({ emblem, className }) => {
    const wear = `menu-ink-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    return (
        <svg className={className} viewBox="0 0 64 64" fill="currentColor" stroke="none" aria-hidden="true" focusable="false">
            <defs>
                <mask id={wear} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                    <rect width="64" height="64" fill="white" />
                    <path d="m14 17 3-1m23 31 2-1M21 28l1-1m18-9 2-1M27 53l2-1M9 38l1-2m39-9 3-1"
                        fill="none" stroke="black" strokeWidth=".8" opacity=".35" />
                </mask>
            </defs>
            <g mask={`url(#${wear})`}>{symbols[emblem]}</g>
        </svg>
    );
};
