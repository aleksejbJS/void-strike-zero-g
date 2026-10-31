// Smooth movement of other players: render them slightly in the past and
// blend between the two snapshots around that moment (snapshots arrive ~30/s).

import { Entity, Vector2 } from '../../types';
import { Snapshot } from './protocol';

export const INTERP_DELAY_MS = 100;
const MAX_BUFFERED = 10;

interface Stamped {
    receivedAt: number;
    positions: Map<string, Vector2>;
}

export class SnapshotBuffer {
    private frames: Stamped[] = [];

    push(snapshot: Snapshot, receivedAt: number) {
        const positions = new Map(snapshot.players.map(p => [p.id, { x: p.pos.x, y: p.pos.y }]));
        this.frames.push({ receivedAt, positions });
        if (this.frames.length > MAX_BUFFERED) this.frames.shift();
    }

    /** Position of `id` at `renderTime`, or null if it isn't in the buffer. */
    sample(id: string, renderTime: number): Vector2 | null {
        const frames = this.frames;
        if (!frames.length) return null;

        // Find the pair of frames that brackets renderTime
        let older = frames[0];
        let newer = frames[0];
        for (const frame of frames) {
            if (frame.receivedAt <= renderTime) older = frame;
            if (frame.receivedAt >= renderTime) { newer = frame; break; }
            newer = frame;
        }

        const a = older.positions.get(id);
        const b = newer.positions.get(id);
        if (!a || !b) return b ?? a ?? null;
        const span = newer.receivedAt - older.receivedAt;
        const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.receivedAt) / span)) : 1;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    clear() {
        this.frames = [];
    }
}

/** Move every non-local player to its interpolated position. */
export const interpolateRemotePlayers = (players: Entity[], buffer: SnapshotBuffer, localId: string, now: number) => {
    const renderTime = now - INTERP_DELAY_MS;
    for (const p of players) {
        if (p.id === localId) continue;
        const pos = buffer.sample(p.id, renderTime);
        if (pos) p.pos = pos;
    }
};
