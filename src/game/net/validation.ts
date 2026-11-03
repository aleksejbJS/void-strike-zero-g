// Validation of untrusted client messages. Everything a client sends goes through here
// before it touches game state — clients can send arbitrary JSON.

import { PlayerInput } from '../../types';
import { SKINS } from '../../constants';
import { JoinRequest, MAX_NAME_LENGTH } from './protocol';
import { sanitizeBuild } from '../build/sanitizeBuild';
import { presetBuild } from '../build/buildPresets';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = '#3b82f6';
const ALLOWED_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'Walk'];
const WORLD_MIN = -5000;
const WORLD_MAX = 10000;
const MAX_WEAPON_SLOTS = 6;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const color = (v: unknown) => (typeof v === 'string' && HEX_COLOR.test(v) ? v : FALLBACK_COLOR);

const clamp = (v: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX, v));

/**
 * Returns a clean JoinRequest, or null if the payload is unusable. Bad colors/skins fall back to defaults.
 * The build is cleaned field by field; a missing or broken field falls back to the skin's preset (older clients send none).
 */
export const validateJoin = (raw: unknown): JoinRequest | null => {
    if (!isObject(raw) || typeof raw.name !== 'string') return null;

    // Strip control characters, trim, cap length
    const name = raw.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return null;

    const skinId = typeof raw.skinId === 'string' && SKINS.some(s => s.id === raw.skinId) ? raw.skinId : SKINS[0].id;

    return {
        name,
        skinId,
        color: color(raw.color),
        headColor: color(raw.headColor),
        torsoColor: color(raw.torsoColor),
        armColor: color(raw.armColor),
        legColor: color(raw.legColor),
        jetpackColor: color(raw.jetpackColor),
        build: sanitizeBuild(raw.build, presetBuild(skinId)),
    };
};

/** Returns a clean PlayerInput, or null if the payload is malformed. Unknown keys are dropped. */
export const validateInput = (raw: unknown, arrivedAt: number): PlayerInput | null => {
    if (!isObject(raw) || !isObject(raw.keys) || !isObject(raw.mouse)) return null;
    const { mouse } = raw;
    if (typeof mouse.x !== 'number' || typeof mouse.y !== 'number' || !Number.isFinite(mouse.x) || !Number.isFinite(mouse.y)) return null;
    if (typeof raw.mousePressed !== 'boolean' || typeof raw.hookPressed !== 'boolean') return null;
    if (typeof raw.sequence !== 'number' || !Number.isInteger(raw.sequence) || raw.sequence < 0) return null;

    const keys: Record<string, boolean> = {};
    for (const key of ALLOWED_KEYS) {
        if (raw.keys[key] === true) keys[key] = true;
    }

    const weaponIndex = Number.isInteger(raw.weaponIndex) && (raw.weaponIndex as number) >= 0 && (raw.weaponIndex as number) < MAX_WEAPON_SLOTS
        ? raw.weaponIndex as number
        : undefined;

    return {
        keys,
        weaponIndex,
        mouse: { x: clamp(mouse.x), y: clamp(mouse.y) },
        mousePressed: raw.mousePressed,
        hookPressed: raw.hookPressed,
        sequence: raw.sequence,
        // Server arrival time — never trust the client's clock
        timestamp: arrivedAt,
    };
};
