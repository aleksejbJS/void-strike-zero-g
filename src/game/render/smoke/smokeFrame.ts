// The SmokeFrame the renderer gives SmokeView each frame, in one object reused every frame (the renderer runs at
// 120 fps: a new frame and view box each time would be garbage for nothing). The view box is the visible world rect.

import type { GameState } from '../../../types';
import type { Viewport } from '../viewport';
import type { SmokeFrame } from './cloudField';
import type { FlameAir } from './flameAir';
import type { SmokeQuality } from './smokeTuning';

/** Fill `prev` (or a new frame) for this frame: the camera is the view centre, `view` says how much world fits the screen. */
export function smokeFrameOf(
    prev: SmokeFrame | null, state: GameState, flame: FlameAir | null, view: Pick<Viewport, 'w' | 'h'>, quality: SmokeQuality,
): SmokeFrame {
    const frame = prev ?? { state, flame, view: { x: 0, y: 0, w: 0, h: 0 }, quality };
    frame.state = state;
    frame.flame = flame;
    frame.quality = quality;
    frame.view.x = state.camera.x - view.w / 2;
    frame.view.y = state.camera.y - view.h / 2;
    frame.view.w = view.w;
    frame.view.h = view.h;
    return frame;
}
