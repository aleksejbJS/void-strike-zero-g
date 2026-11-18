// Evenly spaced points along the paths of moving things (rockets, debris), frame after frame: each thing's path since
// the last frame is cut every `step` px, and the leftover distance carries into the next frame, so the spacing does
// not depend on the frame rate. A thing seen for the first time gives one point where it is; a thing that moved
// farther than JUMP in one frame (a teleport, a respawn, a reused id) starts over there with no points across the gap.
// Things not seen in a frame are forgotten. Visual only.

import { JUMP } from './blastTuning';

type Track = { x: number; y: number; carry: number };
export type TrailPoint = (x: number, y: number) => void;

export class TrailWalker {
    private tracks = new Map<string, Track>();
    private next = new Map<string, Track>();

    /** How many things are followed. */
    get size(): number {
        return this.tracks.size;
    }

    /** `id` is at (x, y) now: call `emit` for each point due on its path since the last frame. */
    walk(id: string, x: number, y: number, step: number, emit: TrailPoint): void {
        const prev = this.tracks.get(id);
        if (!prev || !(step > 0)) {
            this.next.set(id, { x, y, carry: 0 });
            if (!prev) emit(x, y);
            return;
        }
        this.next.set(id, prev);
        const dx = x - prev.x, dy = y - prev.y, len = Math.hypot(dx, dy), x0 = prev.x, y0 = prev.y;
        prev.x = x;
        prev.y = y;
        if (!(len <= JUMP)) { prev.carry = 0; return; }
        let at = step - prev.carry, last = -prev.carry;
        for (; at <= len; at += step) {
            emit(x0 + (dx * at) / len, y0 + (dy * at) / len);
            last = at;
        }
        prev.carry = len - last;
    }

    /** End of the frame: the things not walked since the last call are forgotten. */
    endFrame(): void {
        const old = this.tracks;
        this.tracks = this.next;
        old.clear();
        this.next = old;
    }

    clear(): void {
        this.tracks.clear();
        this.next.clear();
    }
}
