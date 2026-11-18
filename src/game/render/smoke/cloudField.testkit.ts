// Shared helpers for the CloudField tests: clouds, a minimal game state, frames, and a recorder of what each grid is asked to do.

import { vi, type MockInstance } from 'vitest';
import type { GameState, SmokeCloud } from '../../../types';
import { SMOKE_RADIUS } from '../../systems/smoke';
import { AirGrid, type Box, type Stir } from './airGrid';
import type { CloudField, SmokeFrame } from './cloudField';
import { StirFeed } from './stirFeed';
import type { SmokeQuality } from './smokeTuning';

export const FRAME_MS = 1000 / 60;
export const VIEW: Box = { x: 0, y: 0, w: 1600, h: 900 };        // centre (800, 450)
export const T0 = 5000;                                          // clouds in these tests are born at 0: settled by T0

/** A cloud that lives for a minute unless `endsAt` says otherwise. */
export const cloud = (id: string, x: number, y: number, bornAt = 0, endsAt = bornAt + 60_000): SmokeCloud =>
    ({ id, pos: { x, y }, radius: SMOKE_RADIUS, bornAt, endsAt });

/** The parts of a game state the smoke code reads. */
export const stateOf = (over: Partial<GameState> = {}): GameState =>
    ({ projectiles: [], particles: [], beams: [], players: [], platforms: [], cover: [], ...over }) as unknown as GameState;

export const frameOf = (state: GameState = stateOf(), view: Box = VIEW, quality: SmokeQuality = 'low'): SmokeFrame =>
    ({ state, flame: null, view, quality });

/** A fighter at (x, y) (feet) moving fast enough to stir the air: one stir of reach 26 at its middle. */
export const runner = (x: number, y: number): GameState['players'][number] =>
    ({ id: 'p1', pos: { x, y }, vel: { x: 5, y: 0 }, width: 20, height: 52, dead: false }) as unknown as GameState['players'][number];

const feeds = new WeakMap<CloudField, StirFeed>();

/** `field.sync` as SmokeView calls it: the frame's stirs come from a feed that belongs to the field, and are none
 *  while there is no smoke or no frame (the feed then forgets what it followed). */
export function syncFed(field: CloudField, smokes: readonly SmokeCloud[], now: number, frame: SmokeFrame | null): void {
    let feed = feeds.get(field);
    if (!feed) { feed = new StirFeed(); feeds.set(field, feed); }
    const stirs = frame && smokes.length > 0 ? feed.collect(frame.state, frame.flame, now) : feed.idle();
    field.sync(smokes, now, frame, stirs);
}

/** Call `syncFed` for `n` frames of `FRAME_MS` after `start`; returns the time of the last one. */
export function runFrames(field: CloudField, smokes: readonly SmokeCloud[], n: number, frame: SmokeFrame | null, start: number): number {
    let now = start;
    for (let i = 0; i < n; i++) { now += FRAME_MS; syncFed(field, smokes, now, frame); }
    return now;
}

export type StirCall = { st: Stir; dt: number };

/** How many steps `grid` ran, according to `steps`. */
export const stepCount = (steps: Map<AirGrid, number[]>, grid: AirGrid | undefined): number => (grid ? steps.get(grid)?.length ?? 0 : -1);

/** Records the dt of every AirGrid.step and the stirs of every AirGrid.stir (and still does them). Call `restore` when done. */
export function watchGrids(): { steps: Map<AirGrid, number[]>; stirs: Map<AirGrid, StirCall[]>; restore: () => void } {
    const steps = new Map<AirGrid, number[]>(), stirs = new Map<AirGrid, StirCall[]>();
    const step = AirGrid.prototype.step, stir = AirGrid.prototype.stir;
    const spies: MockInstance[] = [
        vi.spyOn(AirGrid.prototype, 'step').mockImplementation(function (this: AirGrid, dt: number) {
            const list = steps.get(this) ?? [];
            list.push(dt);
            steps.set(this, list);
            step.call(this, dt);
        }),
        vi.spyOn(AirGrid.prototype, 'stir').mockImplementation(function (this: AirGrid, st: Stir, dt: number) {
            const list = stirs.get(this) ?? [];
            list.push({ st, dt });
            stirs.set(this, list);
            stir.call(this, st, dt);
        }),
    ];
    return { steps, stirs, restore: () => spies.forEach(s => s.mockRestore()) };
}
