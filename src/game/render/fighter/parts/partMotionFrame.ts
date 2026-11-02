// How the moving parts (tail, floppy ears, lamp, wings) sit in one frame. Filled by the part motion springs.

export interface PartMotionFrame {
    tailLift: number;  // tail raised (+) or lowered (-)
    tailBend: number;  // tail bent back (+) or forward (-)
    tailWave: number;  // phase of the idle wriggle, radians
    earFlop: number;   // 0..1, how far floppy ears are blown back
    lampOn: boolean;   // the lamp antenna is lit
    wingsOpen: number; // 0 folded .. 1 open
}

/** Every part at rest. */
export const IDLE_PARTS: PartMotionFrame = Object.freeze({
    tailLift: 0, tailBend: 0, tailWave: 0, earFlop: 0, lampOn: false, wingsOpen: 0,
});
