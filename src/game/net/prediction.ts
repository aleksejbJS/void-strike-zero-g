// Client-side prediction for the local player (spec D1-b).
// The local player moves immediately from local input. When a snapshot arrives we compare
// the server's position with what we predicted after the same input, and blend the
// difference in over a few ticks instead of snapping (no input replay).

import { Entity, Vector2 } from '../../types';

const HISTORY_SIZE = 512;          // ~4s of inputs at 120 ticks/s
const IGNORE_ERROR_PX = 3;         // floating-point / collision jitter
const SNAP_ERROR_PX = 200;         // too far off (teleport, big knockback): jump straight there
const CORRECTION_PER_TICK = 0.15;  // share of the remaining error removed each tick

export type ReconcileResult = 'ok' | 'corrected' | 'snapped' | 'unknown';

export class LocalPrediction {
    private history = new Map<number, Vector2>();
    private pending: Vector2 = { x: 0, y: 0 };

    /** Remember where we predicted the player to be after applying input `sequence`. */
    record(sequence: number, pos: Vector2) {
        this.history.set(sequence, { x: pos.x, y: pos.y });
        this.history.delete(sequence - HISTORY_SIZE);
    }

    /** Compare the server's view of the local player with our prediction for the same input. */
    reconcile(server: Entity, local: Entity): ReconcileResult {
        const ack = server.lastProcessedInput;
        const predicted = this.history.get(ack);
        for (const seq of this.history.keys()) if (seq < ack) this.history.delete(seq);
        if (!predicted) return 'unknown';

        const error = { x: server.pos.x - predicted.x, y: server.pos.y - predicted.y };
        const size = Math.hypot(error.x, error.y);
        if (size < IGNORE_ERROR_PX) return 'ok';

        if (size > SNAP_ERROR_PX) {
            this.snapTo(server, local);
            return 'snapped';
        }

        // Later predictions were built on the same wrong base: shift them too,
        // so the next snapshot doesn't count this error a second time
        for (const [seq, pos] of this.history) {
            if (seq >= ack) this.history.set(seq, { x: pos.x + error.x, y: pos.y + error.y });
        }
        this.pending.x += error.x;
        this.pending.y += error.y;
        return 'corrected';
    }

    /** Apply a share of the outstanding correction. Call once per tick before recording. */
    applyCorrection(local: Entity) {
        const dx = this.pending.x * CORRECTION_PER_TICK;
        const dy = this.pending.y * CORRECTION_PER_TICK;
        local.pos.x += dx;
        local.pos.y += dy;
        this.pending.x -= dx;
        this.pending.y -= dy;
    }

    /** Hard reset to the server's state (spawn, respawn, huge error). */
    snapTo(server: Entity, local: Entity) {
        local.pos = { x: server.pos.x, y: server.pos.y };
        local.vel = { x: server.vel.x, y: server.vel.y };
        this.pending = { x: 0, y: 0 };
        this.history.clear();
    }
}
