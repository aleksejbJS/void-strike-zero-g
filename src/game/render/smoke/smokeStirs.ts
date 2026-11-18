// What moves the air around smoke this frame, read from the game state the screen already has (so it works
// the same offline and online): projectiles in flight, fresh explosions (their 'ring' particle), fresh
// railgun beams, flamethrower streams and fast fighters. Each source becomes Stirs for AirGrid.stir.
// Rates are per second; heat, soot and carve are amounts per second at the centre. Start values, retuned on the range.

import { GameState, WeaponType } from '../../../types';
import type { Stir } from './airGrid';
import type { FlameAir } from './flameAir';

const STEP = 7;                                   // px between the stirs of a chain
const BLAST_R = 70, BLAST_MIN_SCALE = 0.6, RING_SIZE = 12;
const FLAME_REACH = 260, FLAME_R0 = 12, FLAME_R1 = 38, FLAME_LIFT = 90;
const FIGHTER_MIN_SPEED = 40;                     // px/s
const FRAME_HZ = 60;                              // Entity.vel is per 60 Hz frame

type Spec = Pick<Stir, 'r' | 'rate' | 'heat' | 'soot' | 'carve'>;
const ROCKET: Spec = { r: 16, rate: 40, heat: 15, carve: 21 };
const BULLET: Spec = { r: 10, rate: 40, carve: 15 };
const BEAM: Spec = { r: 13, rate: 45, heat: 12, carve: 33 };
const FLAME: Spec = { r: FLAME_R0, rate: 27, heat: 30, soot: 7, carve: 9 };

/** Stirs every STEP px from (ax, ay) towards (bx, by), each driving the air along that line at `speed`.
 *  `grow` widens the reach and lifts the air from the first stir (0) to the last (1). */
function chain(out: Stir[], ax: number, ay: number, bx: number, by: number, speed: number, spec: Spec, grow?: (f: number, st: Stir) => void): void {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) return;
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    for (let l = 0; l < len; l += STEP) {
        const st: Stir = { ...spec, x: ax + dx * l, y: ay + dy * l, vx: dx * speed, vy: dy * speed };
        if (grow) grow(l / len, st);
        out.push(st);
    }
}

const flareUp = (f: number, st: Stir): void => {
    st.r = FLAME_R0 + f * (FLAME_R1 - FLAME_R0);
    st.vy -= FLAME_LIFT * f;
};

export class SmokeStirs {
    private readonly lastPos = new Map<string, { x: number; y: number }>();
    private readonly alive = new Set<string>();
    private seen = new Set<string>();             // ring and beam ids of the previous collect
    private next = new Set<string>();

    /** How many projectiles are being followed (for tests). */
    get trackedProjectiles(): number { return this.lastPos.size; }
    /** How many ring and beam ids are remembered (for tests). */
    get trackedIds(): number { return this.seen.size; }

    /** Clear `out` and fill it with this frame's stirs. `flame` is the flame engine's read-only view, if any. */
    collect(state: GameState, flame: FlameAir | null, out: Stir[]): void {
        out.length = 0;
        this.projectiles(state, out);
        this.blastsAndBeams(state, out);
        if (flame) this.flames(flame, out);
        this.fighters(state, out);
    }

    private projectiles(state: GameState, out: Stir[]): void {
        const { lastPos, alive } = this;
        alive.clear();
        for (const pr of state.projectiles) {
            alive.add(pr.id);
            // Seen for the first time: the physics tick before this frame is a good guess for where it was
            const prev = lastPos.get(pr.id) ?? { x: pr.pos.x - pr.vel.x, y: pr.pos.y - pr.vel.y };
            const rocket = pr.type === WeaponType.ROCKET_LAUNCHER || pr.type === WeaponType.GRENADE_LAUNCHER;
            chain(out, prev.x, prev.y, pr.pos.x, pr.pos.y, rocket ? 650 : 480, rocket ? ROCKET : BULLET);
            prev.x = pr.pos.x; prev.y = pr.pos.y;
            lastPos.set(pr.id, prev);
        }
        for (const id of lastPos.keys()) if (!alive.has(id)) lastPos.delete(id);
    }

    // A ring or a beam stirs the first frame it is on screen only
    private blastsAndBeams(state: GameState, out: Stir[]): void {
        const { seen, next } = this;
        next.clear();
        for (const pt of state.particles) {
            if (pt.type !== 'ring') continue;
            next.add(pt.id);
            if (seen.has(pt.id)) continue;
            const r = BLAST_R * Math.max(BLAST_MIN_SCALE, pt.size / RING_SIZE);
            out.push({ x: pt.pos.x, y: pt.pos.y, r, vx: 950, vy: 0, radial: true, rate: 60, heat: 55, carve: 40 });
        }
        for (const b of state.beams ?? []) {
            next.add(b.id);
            if (seen.has(b.id)) continue;
            chain(out, b.start.x, b.start.y, b.end.x, b.end.y, 700, BEAM);
        }
        this.seen = next;
        this.next = seen;
    }

    private flames(flame: FlameAir, out: Stir[]): void {
        for (const f of flame.streams()) {
            if (!f.firing) continue;
            const dx = Math.cos(f.angle), dy = Math.sin(f.angle);
            chain(out, f.x, f.y, f.x + dx * FLAME_REACH, f.y + dy * FLAME_REACH, 520, FLAME, flareUp);
        }
    }

    private fighters(state: GameState, out: Stir[]): void {
        for (const p of state.players) {
            if (p.dead) continue;
            const vx = p.vel.x * FRAME_HZ, vy = p.vel.y * FRAME_HZ;
            if (Math.hypot(vx, vy) < FIGHTER_MIN_SPEED) continue;
            out.push({ x: p.pos.x, y: p.pos.y - p.height / 2, r: 26, vx, vy, rate: 24 });
        }
    }
}
