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
    /** Returns the ids of places that currently show a network banner. */
    update(camera: Vector2, fight: ScreenRect[], solids: ScreenRect[], now: number, screenW: number, screenH: number): Set<string>;
    destroy(): void;
}

/**
 * clip-path that cuts the platforms standing in front of the banner out of it (the canvas
 * below draws them), in the banner's own unscaled coordinates.
 */
export const occlusionClip = (rect: ScreenRect, bw: number, bh: number, solids: ScreenRect[]) => {
    const sx = bw / rect.w, sy = bh / rect.h;
    const holes = solids.filter(s => intersects(rect, s)).map(s => {
        const x0 = Math.max(0, (s.x - rect.x) * sx), y0 = Math.max(0, (s.y - rect.y) * sy);
        const x1 = Math.min(bw, (s.x + s.w - rect.x) * sx), y1 = Math.min(bh, (s.y + s.h - rect.y) * sy);
        return `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`;
    });
    return holes.length ? `path(evenodd, 'M0 0H${bw}V${bh}H0Z${holes.join('')}')` : 'none';
};

let tokenSeq = 0;

export const createAdOverlay = (host: HTMLElement, places: AdPlace[], config: AdConfig): AdOverlay => {
    const root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '0' });
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

    return {
        update(camera, fight, solids, now, w, h) {
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
                    ? `translate(${rect.x.toFixed(1)}px,${rect.y.toFixed(1)}px) scale(${(rect.w / s.bw).toFixed(4)},${(rect.h / s.bh).toFixed(4)})|${isOccluded(rect, fight) ? OCCLUDED_OPACITY : 1}|${occlusionClip(rect, s.bw, s.bh, solids)}`
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
