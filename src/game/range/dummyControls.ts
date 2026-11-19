// What a range dummy "presses" each tick: nothing but its stance. It replaces the bot brain, so a
// dummy never runs, jumps, flies, grapples or shoots; C on the keyboard decides how it stands.

import type { Entity } from '../../types';
import type { RangeState } from './rangeState';

export interface DummyControls {
    inputX: 0;
    wantsJump: false;
    jumpKey: false;
    wantsDown: boolean;
    wantsProne: boolean;
    isFlying: false;
}

/** Idle controls for `p` in the stance set on the range (stand when there is no range state). */
export const dummyControls = (_p: Entity, range: RangeState | undefined): DummyControls => ({
    inputX: 0,
    wantsJump: false,
    jumpKey: false,
    wantsDown: range?.stance === 'crouch',
    wantsProne: range?.stance === 'prone',
    isFlying: false,
});
