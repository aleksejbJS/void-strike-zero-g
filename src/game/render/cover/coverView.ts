// Draws GameState.cover: one Sprite per piece with the baked picture of its damage stage (a destroyed
// piece shows its remains). A piece that is due back shows a blinking dashed hazard-yellow outline with a
// progress ring for the last COVER_WARN_MS, and a badly damaged barrel vents (live fire jet over the
// picture). The view only reads cover; it sits at the bottom of the game layer, so fighters, pickups,
// projectiles and effects all draw over it, while platforms (their own layer) stay behind.

import { Container, Graphics, Sprite } from 'pixi.js';
import { COVER_SPECS, COVER_WARN_MS, Cover, CoverKind, CoverStage } from '../../cover/coverTypes';
import { coverStage } from '../../cover/coverGeometry';
import { barrelVent } from './barrelArt';
import { HAZARD } from './coverArtKit';
import { coverResolution, coverTexture, releaseCoverTextures, retainCoverTextures } from './coverTextures';

interface Slot {
    root: Container;   // at the piece's feet; everything below is in the piece's own coordinates
    body: Sprite;
    key: string;       // `${kind}:${stage}:${res}` of the picture on the sprite
    holo?: Graphics;
    vent?: Graphics;
}

const HOLO_COLOR = Number.parseInt(HAZARD.slice(1), 16);
const DASH = 4;
const GAP = 3;
const DASH_SPEED = 14;     // px of dash pattern per second
const RING_RADIUS = 5.5;
const RING_LIFT = 11;      // the ring floats this far above the piece
const ROUND_RADIUS = 4;    // barrel hologram corners
const STAGES: readonly CoverStage[] = [0, 1, 2, 3];

type Point = readonly [number, number];

/** The outline of a rect, with corners rounded when `r` > 0, as a closed polyline. */
const outline = (x: number, y: number, w: number, h: number, r: number): Point[] => {
    if (r <= 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const pts: Point[] = [];
    ([[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]] as const).forEach(([cx, cy, from]) => {
        for (let k = 0; k <= 3; k++) {
            const a = ((from + k * 30) * Math.PI) / 180;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
    });
    return pts;
};

/** Stroke a closed polyline as dashes; `phase` slides the pattern along it. */
const dashedLoop = (g: Graphics, pts: readonly Point[], phase: number) => {
    const period = DASH + GAP;
    let travelled = 0;
    for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        const len = Math.hypot(bx - ax, by - ay);
        const at = (s: number): Point => [ax + ((bx - ax) * s) / len, ay + ((by - ay) * s) / len];
        let s = 0;
        while (s < len) {
            const m = (((travelled + s + phase) % period) + period) % period;
            const end = Math.min(len, s + (m < DASH ? DASH - m : period - m));
            if (m < DASH) g.moveTo(...at(s)).lineTo(...at(end));
            s = Math.max(end, s + 0.01);
        }
        travelled += len;
    }
    g.stroke({ width: 1.2, color: HOLO_COLOR });
};

/** The returning piece: faint scan-lined body, marching dashed outline, and a ring that fills as it nears. */
const drawHologram = (g: Graphics, kind: CoverKind, progress: number, now: number) => {
    const { w, h } = COVER_SPECS[kind], x = -w / 2, y = -h;
    g.clear();
    g.alpha = 0.6 + 0.4 * Math.abs(Math.sin((now / 1000) * 9)); // blinks
    const shape = outline(x, y, w, h, kind === 'barrel' ? ROUND_RADIUS : 0);
    g.poly(shape.flat()).fill({ color: HOLO_COLOR, alpha: 0.08 });
    for (let yy = y + 3; yy < y + h - 3; yy += 2.5) g.rect(x + 1, yy, w - 2, 0.8);
    g.fill({ color: HOLO_COLOR, alpha: 0.22 });
    dashedLoop(g, shape, (now / 1000) * DASH_SPEED);
    const cy = y - RING_LIFT, start = -Math.PI / 2;
    g.circle(0, cy, RING_RADIUS).stroke({ width: 2, color: HOLO_COLOR, alpha: 0.25 });
    if (progress > 0) {
        g.moveTo(Math.cos(start) * RING_RADIUS, cy + Math.sin(start) * RING_RADIUS)
            .arc(0, cy, RING_RADIUS, start, start + Math.min(1, progress) * Math.PI * 2)
            .stroke({ width: 2, color: HOLO_COLOR });
    }
};

const dispose = (obj: Container) => {
    obj.parent?.removeChild(obj);
    if (!obj.destroyed) obj.destroy({ children: true, context: true });
};

export class CoverView {
    private readonly container = new Container();
    private readonly slots = new Map<string, Slot>();
    private readonly prepared = new Set<string>(); // `${kind}:${res}` with every stage baked
    private cleared = false;

    constructor(private readonly layer: Container) {
        retainCoverTextures();
        this.lower();
    }

    /**
     * Show exactly the given pieces. `now` is the clock the pieces' returnsAt is on (ms); `zoom` is how many
     * screen pixels a world unit takes, so the pictures are baked sharp for this screen.
     */
    sync(cover: readonly Cover[], now: number, zoom = 1): void {
        this.lower();
        const res = coverResolution(zoom);
        const live = new Set<string>();
        for (const piece of cover) {
            live.add(piece.id);
            const slot = this.slots.get(piece.id) ?? this.add(piece);
            slot.root.position.set(piece.pos.x, piece.pos.y);
            this.prepare(piece.kind, res);
            this.showBody(slot, piece, res);
            this.showHologram(slot, piece, now);
            this.showVent(slot, piece, now);
        }
        for (const [id, slot] of this.slots) {
            if (live.has(id)) continue;
            dispose(slot.root);
            this.slots.delete(id);
        }
    }

    /** Destroy every sprite and the container, and let go of the baked pictures; the view is not usable afterwards. */
    clear(): void {
        if (this.cleared) return;
        this.cleared = true;
        this.slots.clear();
        dispose(this.container);
        releaseCoverTextures();
    }

    // The view is the bottom of the layer: pickups, fighters and effects are added after it (and a view
    // made after the first frame, e.g. when a round restarts, must still go under them)
    private lower(): void {
        if (this.layer.children[0] !== this.container) this.layer.addChildAt(this.container, 0);
    }

    private add(piece: Cover): Slot {
        const root = new Container();
        root.label = piece.id;
        const body = new Sprite();
        body.label = 'body';
        root.addChild(body);
        this.container.addChild(root);
        const slot: Slot = { root, body, key: '' };
        this.slots.set(piece.id, slot);
        return slot;
    }

    // The first time a kind shows at this resolution (the map loads), bake all its stages: a piece
    // breaking mid-fight then only swaps pictures and never stalls a frame on a bake
    private prepare(kind: CoverKind, res: number): void {
        if (this.prepared.has(`${kind}:${res}`)) return;
        this.prepared.add(`${kind}:${res}`);
        for (const stage of STAGES) coverTexture(kind, stage, res);
    }

    // A new stage or resolution gets its picture; so does a sprite whose picture was freed under it
    private showBody(slot: Slot, piece: Cover, res: number): void {
        const stage = coverStage(piece), key = `${piece.kind}:${stage}:${res}`;
        if (slot.key === key && !slot.body.texture.destroyed) return;
        const baked = coverTexture(piece.kind, stage, res);
        slot.body.texture = baked.texture;
        slot.body.anchor.set(baked.anchorX, baked.anchorY);
        slot.body.scale.set(1 / res);
        slot.key = key;
    }

    // Only a piece that is gone and due back soon; a blocked return keeps showing it past returnsAt
    private showHologram(slot: Slot, piece: Cover, now: number): void {
        const left = piece.hp > 0 || piece.returnsAt === undefined ? Infinity : piece.returnsAt - now;
        if (left > COVER_WARN_MS) {
            if (slot.holo) { dispose(slot.holo); slot.holo = undefined; }
            return;
        }
        if (!slot.holo) {
            slot.holo = new Graphics();
            slot.holo.label = 'holo';
            slot.root.addChild(slot.holo);
        }
        drawHologram(slot.holo, piece.kind, 1 - left / COVER_WARN_MS, now);
    }

    private showVent(slot: Slot, piece: Cover, now: number): void {
        if (piece.kind !== 'barrel' || coverStage(piece) !== 2) {
            if (slot.vent) { dispose(slot.vent); slot.vent = undefined; }
            return;
        }
        if (!slot.vent) {
            slot.vent = new Graphics();
            slot.vent.label = 'vent';
            slot.vent.blendMode = 'add';
            slot.root.addChild(slot.vent);
        }
        slot.vent.clear();
        barrelVent(slot.vent, 0, 0, now / 1000);
    }
}
