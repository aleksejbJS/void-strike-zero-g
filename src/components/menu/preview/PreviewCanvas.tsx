// Live mode preview drawn by the game's renderer, on the page-wide preview app (see previewApp).
// Runs its director at the physics tick rate, pauses while the tab is hidden or the preview is
// scrolled away, shows one still frame for reduced motion, and reports failure so the menu can
// fall back to the schematic scene.

import React, { useEffect, useRef } from 'react';
import { GameMode, MapId } from '../../../types';
import { generateAssets } from '../../../game/systems/assets';
import { FixedStepper } from '../../../game/systems/fixedStep';
import { createDirector } from './previewDirector';
import { createPreviewRenderer } from './previewRenderer';
import { clearPreviewStage, previewApp } from './previewApp';
import { ModeScript } from './previewScript';
import { actorEntityId, YouLook } from './previewWorld';

const STILL_FRAME_TICKS = 240; // reduced motion: the moment 2 s into the loop

const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
    script: ModeScript;
    mode: GameMode;
    map: MapId;
    you: YouLook;
    youText: string;
    onReady: () => void;
    onFail: () => void;
}

export const PreviewCanvas: React.FC<Props> = ({ script, mode, map, you, youText, onReady, onFail }) => {
    const host = useRef<HTMLDivElement>(null);
    // Callbacks change every render; the scene is only rebuilt for a new script, map or look
    const callbacks = useRef({ onReady, onFail });
    callbacks.current = { onReady, onFail };

    useEffect(() => {
        let cancelled = false;
        let teardown = () => {};

        const setup = async () => {
            const [textures, app] = await Promise.all([generateAssets(), previewApp()]);
            if (cancelled) return;
            const director = createDirector(script, mode, map, you);
            const renderer = createPreviewRenderer(app, director.state, textures, youText);
            const labelled = script.actors.find(a => a.label);
            const labelledId = labelled ? actorEntityId(labelled.id) : null;
            host.current?.replaceChildren(app.canvas);

            const stepper = new FixedStepper();
            const frame = () => {
                stepper.advance(app.ticker.deltaMS, () => director.tick(Date.now()));
                renderer.draw(director.state, labelledId);
            };
            let stopWatching = () => {};
            if (prefersReducedMotion()) {
                for (let i = 0; i < STILL_FRAME_TICKS; i++) director.tick(Date.now());
                renderer.draw(director.state, labelledId);
                app.render();
            } else {
                app.ticker.add(frame);
                stopWatching = watchVisibility(host.current, visible => (visible ? app.ticker.start() : app.ticker.stop()));
            }
            teardown = () => {
                stopWatching();
                app.ticker.remove(frame);
                app.ticker.stop();
                renderer.destroy();
                clearPreviewStage(app);
                app.canvas.remove();
            };
            callbacks.current.onReady();
        };

        setup().catch(err => {
            console.error('Mode preview failed to start, showing the schematic scene:', err);
            teardown();
            teardown = () => {};
            if (!cancelled) callbacks.current.onFail();
        });
        return () => {
            cancelled = true;
            teardown();
        };
    }, [script, mode, map, you, youText]);

    return <div ref={host} aria-hidden="true" className="absolute inset-0" />;
};

/** Calls back with false while the tab is hidden or the element is off-screen. */
const watchVisibility = (el: HTMLElement | null, onChange: (visible: boolean) => void) => {
    let onScreen = true;
    const update = () => onChange(onScreen && !document.hidden);
    document.addEventListener('visibilitychange', update);
    const observer = el && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); })
        : null;
    if (el) observer?.observe(el);
    update();
    return () => {
        document.removeEventListener('visibilitychange', update);
        observer?.disconnect();
    };
};
