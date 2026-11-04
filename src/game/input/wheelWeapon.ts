// Mouse-wheel weapon switching: one wheel notch, or one trackpad swipe, moves one slot.
// Wheel down = next slot, wheel up = previous; empty slots are skipped and the ends wrap round.

/**
 * A wheel event closer than this to the previous one belongs to the same gesture and is ignored.
 * A trackpad swipe (with its momentum tail) fires a burst of events ~16 ms apart: it switches once.
 */
export const WHEEL_GESTURE_GAP_MS = 150;

type WheelLike = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'ctrlKey'>;

/** +1 for wheel down, -1 for wheel up, 0 for a pinch-zoom (ctrl) or a mostly horizontal swipe. */
export const wheelStep = (e: WheelLike): -1 | 0 | 1 => {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return 0;
    return e.deltaY > 0 ? 1 : -1;
};

/**
 * The next filled slot after `current` going `step`, wrapping round.
 * `current` -1 (nothing held) starts from the first slot going down, from the last going up.
 * Null when no other filled slot exists.
 */
export const cycleWeaponIndex = (slots: ReadonlyArray<unknown>, current: number, step: 1 | -1): number | null => {
    const n = slots.length;
    if (n === 0) return null;
    const from = current >= 0 && current < n ? current : step > 0 ? -1 : n;
    for (let i = 1; i <= n; i++) {
        const index = (((from + step * i) % n) + n) % n;
        if (index !== current && slots[index]) return index;
    }
    return null;
};

/** True when this wheel event starts a new gesture; every event (taken or not) extends the current one. */
export const createWheelGate = (gapMs = WHEEL_GESTURE_GAP_MS) => {
    let lastEventAt = -Infinity;
    return (now: number): boolean => {
        const fresh = now - lastEventAt >= gapMs;
        lastEventAt = now;
        return fresh;
    };
};

export interface WheelWeaponHooks {
    /** The local player's slots and the index of the weapon in hand (-1 when none); null before joining. */
    getLoadout: () => { slots: ReadonlyArray<unknown>; current: number } | null;
    select: (index: number) => void;
}

/** Listens for the wheel on `target` and switches weapons. Returns the detach function. */
export const attachWheelWeapon = (target: Window, hooks: WheelWeaponHooks): (() => void) => {
    const gate = createWheelGate();
    const onWheel = (e: WheelEvent) => {
        const step = wheelStep(e);
        if (step === 0 || !gate(e.timeStamp)) return;
        const loadout = hooks.getLoadout();
        if (!loadout) return;
        const next = cycleWeaponIndex(loadout.slots, loadout.current, step);
        if (next !== null) hooks.select(next);
    };
    target.addEventListener('wheel', onWheel, { passive: true });
    return () => target.removeEventListener('wheel', onWheel);
};
