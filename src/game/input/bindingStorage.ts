// The player's key bindings, kept in this browser only. Whatever is stored is untrusted: it is sanitized
// on every load, and anything unreadable falls back to the defaults with a warning.

import { readStored, writeStored } from '../../store/playerStorage';
import { BIND_ACTIONS, BindAction, Bindings, BindingSlots, DEFAULT_BINDINGS, InputCode, isReserved, normalizeCode } from './bindings';

export const BINDINGS_STORAGE_KEY = 'controls.v1';
const FORMAT_VERSION = 1;
const CODE_RE = /^[A-Za-z0-9]{1,24}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Any value → valid bindings. In display order, a slot keeps an input only if it is well formed, not reserved
 * and not used by an earlier slot. Unknown actions are ignored. An action missing from `raw` (added by a newer
 * build than the one that saved) gets its defaults, minus inputs the stored actions already use.
 */
export function sanitizeBindings(raw: unknown): Bindings {
    if (!isRecord(raw)) return DEFAULT_BINDINGS;
    const used = new Set<InputCode>();
    const take = (value: unknown): InputCode | null => {
        if (typeof value !== 'string' || !CODE_RE.test(value)) return null;
        const code = normalizeCode(value);
        if (isReserved(code) || used.has(code)) return null;
        used.add(code);
        return code;
    };
    const result = {} as Record<BindAction, BindingSlots>;
    const missing: BindAction[] = [];
    for (const action of BIND_ACTIONS) {
        if (!(action in raw)) { missing.push(action); continue; }
        const value = raw[action];
        result[action] = Array.isArray(value) && value.length === 2 ? [take(value[0]), take(value[1])] : [null, null];
    }
    for (const action of missing) {
        const [primary, secondary] = DEFAULT_BINDINGS[action];
        result[action] = [take(primary), take(secondary)];
    }
    return result;
}

export function loadBindings(): Bindings {
    const text = readStored(BINDINGS_STORAGE_KEY);
    if (text === null) return DEFAULT_BINDINGS;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        console.warn('Stored key bindings are unreadable, using the defaults:', err);
        return DEFAULT_BINDINGS;
    }
    if (!isRecord(parsed) || parsed.v !== FORMAT_VERSION) {
        console.warn('Stored key bindings have an unknown format, using the defaults');
        return DEFAULT_BINDINGS;
    }
    return sanitizeBindings(parsed.bindings);
}

const listeners = new Set<() => void>();

/** Called after every save: the menu under the profile shows the new keys at once. Returns the unsubscribe. */
export function onBindingsChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function saveBindings(b: Bindings): void {
    writeStored(BINDINGS_STORAGE_KEY, JSON.stringify({ v: FORMAT_VERSION, bindings: b }));
    listeners.forEach(listener => listener());
}
