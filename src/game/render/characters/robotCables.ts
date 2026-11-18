// Cables hanging out of a robot's torn socket: pure geometry, drawn by robotWounds.ts.
// Each cable leaves the socket outward, curls a little and sways with time and with the body's motion.
// A stable seed per fighter or corpse keeps every bundle's look from frame to frame.
import type { Vector2 } from '../../../types';
import type { Socket } from './robotSockets';

export const CABLE_COLORS = ['#c0392b', '#e6b422', '#2e6fd1', '#1c1b1a', '#2f8f4e'] as const;
const MIN_LENGTH = 4, MAX_LENGTH = 9;        // rig units
const SPREAD = 0.55, SWAY = 0.16, LAG = 0.015; // radians; LAG per world unit of motion

export interface Cable { from: Vector2; ctrl: Vector2; to: Vector2; color: string }

/** 0..1, the same for the same seed and index. */
const hash = (seed: number, i: number): number => {
    let h = (seed * 374761393 + i * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const turn = (v: Vector2, a: number): Vector2 => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });

export const cableCurves = (socket: Socket, seed: number, time: number, motion: Vector2): Cable[] => {
    const side = { x: -socket.dir.y, y: socket.dir.x };
    // Moving drags the tips back; the lag stays small so a cable never points into the body
    const lag = Math.max(-0.25, Math.min(0.25, -(motion.x * side.x + motion.y * side.y) * LAG));
    return CABLE_COLORS.map((color, i) => {
        const spread = (i / (CABLE_COLORS.length - 1) - 0.5) * 2 * SPREAD + (hash(seed, i) - 0.5) * 0.2;
        const sway = Math.sin(time * (1.3 + hash(seed, i + 10)) + hash(seed, i + 20) * Math.PI * 2) * SWAY;
        const length = MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) * hash(seed, i + 30);
        const out = turn(socket.dir, spread + sway + lag);
        const offset = (i / (CABLE_COLORS.length - 1) - 0.5) * socket.radius;
        const from = { x: socket.at.x + side.x * offset, y: socket.at.y + side.y * offset };
        const to = { x: from.x + out.x * length, y: from.y + out.y * length };
        const curl = (hash(seed, i + 40) - 0.5) * length * 0.6;
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        return { from, to, color, ctrl: { x: mid.x + out.y * -curl, y: mid.y + out.x * curl } };
    });
};
