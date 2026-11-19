// "Press a key…": while active, the next key or mouse button is captured for a binding slot.
// Listens on window in the capture phase and swallows what it handles, so Escape closes only the capture
// and the mouse back / forward buttons never navigate away.

import { useEffect, useRef } from 'react';
import { InputCode, isReserved, mouseCode, normalizeCode } from '../../game/input/bindings';

const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
};

const AFTER_CLICK = ['mouseup', 'click', 'auxclick', 'contextmenu'] as const;

/**
 * A captured button still sends its mouseup / click / context menu after the capture closed (it closes on the
 * mousedown): they would land on the slot under the cursor and open it again. Swallow them until the button is up.
 */
function swallowRestOfClick(): void {
    const options = { capture: true };
    const stop = () => AFTER_CLICK.forEach(type => window.removeEventListener(type, onEvent, options));
    function onEvent(e: Event) {
        swallow(e);
        // The click follows its mouseup in the same task: stop listening right after it
        if (e.type === 'mouseup') setTimeout(stop, 0);
    }
    AFTER_CLICK.forEach(type => window.addEventListener(type, onEvent, options));
}

export function useCaptureInput(active: boolean, onCapture: (code: InputCode) => void, onCancel: () => void): void {
    const capture = useRef(onCapture);
    const cancel = useRef(onCancel);
    useEffect(() => { capture.current = onCapture; cancel.current = onCancel; });

    useEffect(() => {
        if (!active) return;
        const onKeyDown = (e: KeyboardEvent) => {
            const code = normalizeCode(e.code);
            if (code === 'Escape') { swallow(e); cancel.current(); return; }
            if (!code || isReserved(code)) return; // reserved keys keep the capture open
            swallow(e);
            capture.current(code);
        };
        const onMouseDown = (e: MouseEvent) => {
            const code = mouseCode(e.button);
            if (!code) return;
            swallow(e);
            swallowRestOfClick();
            capture.current(code);
        };
        // The click that follows the captured button and the right-button menu must not act on the page
        const onMouseUp = (e: MouseEvent) => swallow(e);
        const onContextMenu = (e: MouseEvent) => swallow(e);
        const options = { capture: true };
        window.addEventListener('keydown', onKeyDown, options);
        window.addEventListener('mousedown', onMouseDown, options);
        window.addEventListener('mouseup', onMouseUp, options);
        window.addEventListener('contextmenu', onContextMenu, options);
        return () => {
            window.removeEventListener('keydown', onKeyDown, options);
            window.removeEventListener('mousedown', onMouseDown, options);
            window.removeEventListener('mouseup', onMouseUp, options);
            window.removeEventListener('contextmenu', onContextMenu, options);
        };
    }, [active]);
}
