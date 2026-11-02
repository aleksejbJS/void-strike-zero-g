// Colors and skin style of a fighter, from a player entity or from the character-setup choices.

import { Entity } from '../../../types';
import { SKINS } from '../../../constants';

export type FighterStyle = 'human' | 'robot' | 'beast' | 'alien';

export interface FighterLook {
    head: number;
    torso: number;
    arm: number;
    leg: number;
    jet: number;
    accent: number;
    style: FighterStyle;
}

const DEFAULT_LEG = 0x475569;
const DEFAULT_JET = 0xfbbf24;
const DEFAULT_ACCENT = 0xe5e7eb;

const toNumber = (color: string | undefined, fallback: number) =>
    color && /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : fallback;

const skinOf = (skinId: string | undefined) => SKINS.find(s => s.id === skinId);

const styleOf = (skin: ReturnType<typeof skinOf>): FighterStyle => {
    const style = skin?.style;
    return style === 'robot' || style === 'beast' || style === 'alien' ? style : 'human';
};

const accentOf = (skin: ReturnType<typeof skinOf>) =>
    toNumber(skin && 'accent' in skin ? skin.accent : undefined, DEFAULT_ACCENT);

export const lookFromEntity = (p: Pick<Entity, 'color' | 'headColor' | 'torsoColor' | 'armColor' | 'legColor' | 'jetpackColor' | 'skinId'>): FighterLook => {
    const skin = skinOf(p.skinId);
    const torso = toNumber(p.torsoColor || p.color, 0xffffff);
    return {
        torso,
        head: toNumber(p.headColor || p.color, torso),
        arm: toNumber(p.armColor || p.color, torso),
        leg: toNumber(p.legColor, DEFAULT_LEG),
        jet: toNumber(p.jetpackColor, DEFAULT_JET),
        accent: accentOf(skin),
        style: styleOf(skin),
    };
};

export interface SetupColors { head: string; torso: string; arms: string; legs: string; jetpack: string }

export const lookFromSetup = (colors: SetupColors, skinId: string): FighterLook => {
    const skin = skinOf(skinId);
    return {
        head: toNumber(colors.head, 0xffffff),
        torso: toNumber(colors.torso, 0xffffff),
        arm: toNumber(colors.arms, 0xffffff),
        leg: toNumber(colors.legs, DEFAULT_LEG),
        jet: toNumber(colors.jetpack, DEFAULT_JET),
        accent: accentOf(skin),
        style: styleOf(skin),
    };
};

/** Darken (k < 1) or lighten (k > 1) a 0xRRGGBB color. */
export const shade = (color: number, k: number) => {
    const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 255) * k)));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

const FLASH_LIGHTEN = 0.7;

/** The look brightened for a hit flash (amount 0..1); the same object when there is no flash. */
export const flashLook = (look: FighterLook, amount: number): FighterLook => {
    if (amount <= 0) return look;
    const k = 1 + FLASH_LIGHTEN * amount;
    return {
        ...look,
        head: shade(look.head, k), torso: shade(look.torso, k), arm: shade(look.arm, k),
        leg: shade(look.leg, k), jet: shade(look.jet, k),
    };
};
