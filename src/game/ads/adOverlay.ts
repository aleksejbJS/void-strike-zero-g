// Real TrafficStars banners over the game canvas, each one exactly inside its in-world frame.
// A spot gives JS/iframe code only, which the game cannot paint onto its canvas, so the
// banner lives in a sandboxed iframe that follows the camera every frame.

import { AdConfig } from './adConfig';
import { ScreenRect, intersects, isOccluded, newPlaceViewState, PlaceViewState, stepPlace, visibleShare } from './adVisibility';
import { AdPlace, layerToScreen } from '../render/scene/adPlaces';
import { Vector2 } from '../../types';

const FILL_CHECK_MS = 5000;
const OCCLUDED_OPACITY = 0.25;

// The scene's light and wear on top of the banner, per frame kind
const FILTER: Record<AdPlace['kind'], string> = {
    lightbox: 'brightness(0.82) contrast(0.95) saturate(0.9)',
    decal: 'brightness(0.74) sepia(0.15) saturate(0.85)',
    screen: 'brightness(0.86) saturate(0.95)',
};
const SHEEN = 'linear-gradient(115deg, rgba(200,230,255,0) 22%, rgba(200,230,255,0.10) 30%, rgba(200,230,255,0) 44%)';

/** The banner page: spot code plus a check that tells the game whether anything showed up. */
export const bannerDocument = (code: string, token: string) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>${code}
<script>setTimeout(function(){var shown=Array.prototype.some.call(document.body.querySelectorAll('*'),function(e){return !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName)&&e.offsetWidth>0&&e.offsetHeight>0});
parent.postMessage({voidStrikeAd:${JSON.stringify(token)},filled:shown},'*');},${FILL_CHECK_MS});</script></body></html>`;

interface Slot {
    place: AdPlace;
    code: string;
    bw: number;
    bh: number;
    wrap: HTMLDivElement;
    frame: HTMLIFrameElement | null;
    token: string;
    filled: boolean | null; // null = still checking
    view: PlaceViewState;
    lastStyle: string;
}

export interface AdOverlay {
    /** Returns the ids of places that currently show a network banner. `solidsFor` lists what
     *  stands in front of a place on screen (platforms, girders) to cut out of its banner. */
    /** Rects and `screenW`/`screenH` are on the virtual screen (see render/viewport); `zoom` scales it to the window. */
    update(camera: Vector2, fight: ScreenRect[], solidsFor: (place: AdPlace, rect: ScreenRect) => ScreenRect[], now: number, screenW: number, screenH: number, zoom?: number): Set<string>;
    destroy(): void;
}

/**
 * clip-path that cuts what stands in front of the banner (platforms, girders — the canvas below
 * draws them) out of it, in the banner's own unscaled coordinates. The visible part is built
 * from non-overlapping cells, so overlapping cut-outs (a girder crossing a pipe) stay cut.
 */
export const occlusionClip = (rect: ScreenRect, bw: number, bh: number, solids: ScreenRect[]) => {
    const sx = bw / rect.w, sy = bh / rect.h;
    const holes = solids.filter(s => intersects(rect, s)).map(s => ({
        x0: Math.max(0, (s.x - rect.x) * sx), y0: Math.max(0, (s.y - rect.y) * sy),
        x1: Math.min(bw, (s.x + s.w - rect.x) * sx), y1: Math.min(bh, (s.y + s.h - rect.y) * sy),
    }));
    if (!holes.length) return 'none';
    const edges = (a: number[], max: number) => [...new Set([0, max, ...a])].sort((p, q) => p - q);
    const xs = edges(holes.flatMap(h => [h.x0, h.x1]), bw), ys = edges(holes.flatMap(h => [h.y0, h.y1]), bh);
    const cut = (x: number, y: number) => holes.some(h => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);
    let path = '';
    for (let j = 0; j < ys.length - 1; j++) {
        const cy = (ys[j] + ys[j + 1]) / 2;
        for (let i = 0; i < xs.length - 1; i++) {
            if (cut((xs[i] + xs[i + 1]) / 2, cy)) continue;
            let k = i; // merge visible cells along the row
            while (k + 1 < xs.length - 1 && !cut((xs[k + 1] + xs[k + 2]) / 2, cy)) k++;
            path += `M${xs[i].toFixed(1)} ${ys[j].toFixed(1)}H${xs[k + 1].toFixed(1)}V${ys[j + 1].toFixed(1)}H${xs[i].toFixed(1)}Z`;
            i = k;
        }
    }
    return `path('${path || 'M0 0Z'}')`;
};

let tokenSeq = 0;

export const createAdOverlay = (host: HTMLElement, places: AdPlace[], config: AdConfig): AdOverlay => {
    const root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    Object.assign(root.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '0', transformOrigin: '0 0' });
    host.insertBefore(root, host.firstChild);

    const slots: Slot[] = places.flatMap(place => {
        const cfg = config.places[place.id];
        if (!cfg?.enabled || cfg.size !== place.size) return [];
        const [bw, bh] = place.size.split('x').map(Number);
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'absolute', left: '0', top: '0', width: `${bw}px`, height: `${bh}px`, display: 'none',
            transformOrigin: '0 0', filter: FILTER[place.kind], transition: 'opacity 0.25s',
        });
        if (place.kind !== 'decal') {
            const sheen = document.createElement('div');
            Object.assign(sheen.style, { position: 'absolute', inset: '0', background: SHEEN, zIndex: '1' });
            wrap.appendChild(sheen);
        }
        root.appendChild(wrap);
        return [{ place, code: cfg.code, bw, bh, wrap, frame: null, token: '', filled: null, view: newPlaceViewState(), lastStyle: '' }];
    });

    const mount = (s: Slot) => {
        s.frame?.remove();
        s.token = `vs-ad-${++tokenSeq}`;
        s.filled = null;
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
        f.setAttribute('scrolling', 'no');
        f.title = 'Advertisement';
        Object.assign(f.style, { width: `${s.bw}px`, height: `${s.bh}px`, border: '0', display: 'block', background: 'transparent' });
        f.srcdoc = bannerDocument(s.code, s.token);
        s.wrap.insertBefore(f, s.wrap.firstChild);
        s.frame = f;
    };

    // Nothing showed up within a few seconds: hide the banner, the house poster shows through
    const onMessage = (e: MessageEvent) => {
        const data = e.data as { voidStrikeAd?: string; filled?: boolean } | null;
        if (!data || typeof data.voidStrikeAd !== 'string') return;
        const s = slots.find(x => x.token === data.voidStrikeAd && x.frame?.contentWindow === e.source);
        if (s) s.filled = data.filled === true;
    };
    window.addEventListener('message', onMessage);

    // The root is the virtual screen, scaled to the window like the canvas world
    let rootStyle = '';
    const fitRoot = (w: number, h: number, zoom: number) => {
        const next = `${w.toFixed(1)}|${h.toFixed(1)}|${zoom.toFixed(4)}`;
        if (next === rootStyle) return;
        rootStyle = next;
        Object.assign(root.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${zoom})` });
    };

    return {
        update(camera, fight, solidsFor, now, w, h, zoom = 1) {
            fitRoot(w, h, zoom);
            const showing = new Set<string>();
            let loaded = slots.filter(s => s.frame).length;
            for (const s of slots) {
                const rect = layerToScreen(s.place, s.place.layer, camera, w, h);
                const share = visibleShare(rect, w, h);
                const action = stepPlace(s.view, share, now, config.refreshSec * 1000, loaded);
                if (action === 'load') loaded++;
                if (action !== 'none') mount(s);
                if (s.frame !== null && s.filled !== false) showing.add(s.place.id);
                const show = share > 0 && showing.has(s.place.id);
                const style = show
                    ? `translate(${rect.x.toFixed(1)}px,${rect.y.toFixed(1)}px) scale(${(rect.w / s.bw).toFixed(4)},${(rect.h / s.bh).toFixed(4)})|${isOccluded(rect, fight) ? OCCLUDED_OPACITY : 1}|${occlusionClip(rect, s.bw, s.bh, solidsFor(s.place, rect))}`
                    : 'hidden';
                if (style === s.lastStyle) continue;
                s.lastStyle = style;
                if (!show) { s.wrap.style.display = 'none'; continue; }
                const [transform, opacity, clipPath] = style.split('|');
                Object.assign(s.wrap.style, { display: 'block', transform, opacity, clipPath });
            }
            return showing;
        },
        destroy() {
            window.removeEventListener('message', onMessage);
            root.remove();
        },
    };
};
