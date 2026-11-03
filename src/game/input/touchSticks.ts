// Touch listeners for twin-stick play: a thumb landing on the left half of the canvas starts the
// move stick, on the right half the aim stick. Each stick follows its own finger (by touch id),
// so both thumbs work at once. Buttons over the canvas (hook, weapons) never reach these handlers.

import { Stick } from './sticks';

export interface TouchSticksState {
    move: Stick | null;
    aim: Stick | null;
}

type Side = keyof TouchSticksState;

/** Starts listening on `canvas`; returns the function that stops. */
export const attachTouchSticks = (canvas: HTMLCanvasElement, onChange: (sticks: TouchSticksState) => void): () => void => {
    const sticks: TouchSticksState = { move: null, aim: null };
    const owners: Record<Side, number | null> = { move: null, aim: null };
    const emit = () => onChange({ move: sticks.move && { ...sticks.move }, aim: sticks.aim && { ...sticks.aim } });

    const sideOf = (touch: Touch): Side => {
        const rect = canvas.getBoundingClientRect();
        return touch.clientX - rect.left < rect.width / 2 ? 'move' : 'aim';
    };
    const sideOwning = (id: number): Side | null =>
        owners.move === id ? 'move' : owners.aim === id ? 'aim' : null;

    const onStart = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            const side = sideOf(touch);
            if (owners[side] !== null) continue; // that thumb is already down
            owners[side] = touch.identifier;
            sticks[side] = { originX: touch.clientX, originY: touch.clientY, x: touch.clientX, y: touch.clientY };
        }
        emit();
    };

    const onMove = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            const side = sideOwning(touch.identifier);
            const stick = side && sticks[side];
            if (stick) { stick.x = touch.clientX; stick.y = touch.clientY; }
        }
        emit();
    };

    const onEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            const side = sideOwning(touch.identifier);
            if (side) { owners[side] = null; sticks[side] = null; }
        }
        emit();
    };

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
        canvas.removeEventListener('touchstart', onStart);
        canvas.removeEventListener('touchmove', onMove);
        canvas.removeEventListener('touchend', onEnd);
        canvas.removeEventListener('touchcancel', onEnd);
    };
};
