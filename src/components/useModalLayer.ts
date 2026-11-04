// What every full-screen window (the account window, the logout question) does while it is open: the rest
// of the page is `inert`, so neither Tab nor a click can reach Start behind it; Escape closes it; and focus
// goes back to whatever opened it.

import { RefObject, useEffect, useRef } from 'react';

/**
 * Makes everything outside `layer` inert: its siblings, its parent's siblings and so on up to <body>.
 * Elements that were inert already are left alone. Returns the undo.
 */
export function inertOutside(layer: HTMLElement): () => void {
    const changed: Element[] = [];
    for (let node: Element = layer; node.parentElement && node !== document.body; node = node.parentElement) {
        for (const sibling of Array.from(node.parentElement.children)) {
            if (sibling === node || sibling.hasAttribute('inert')) continue;
            sibling.setAttribute('inert', '');
            changed.push(sibling);
        }
    }
    return () => { for (const element of changed) element.removeAttribute('inert'); };
}

/**
 * Call first in the window component (before it moves focus into itself), with a ref to its outermost
 * element. `onEscape` may change between renders.
 */
export function useModalLayer(layer: RefObject<HTMLElement | null>, onEscape: () => void): void {
    const escape = useRef(onEscape);
    useEffect(() => { escape.current = onEscape; });

    useEffect(() => {
        const element = layer.current;
        if (!element) {
            console.error('[modal] the window element is missing: the page behind it stays reachable');
            return;
        }
        const opener = document.activeElement;
        const undo = inertOutside(element);
        return () => {
            undo(); // first: an inert element cannot take focus back
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, [layer]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') escape.current(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
}
