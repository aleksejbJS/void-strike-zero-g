// Where the test range's on-world readout sits (world units, y grows down): the bars and the "last 3 s" total over each
// target. Shared by RangeOverlay and the range map test that keeps every readout on screen.

export const BAR_W = 40;
export const BAR_H = 4;
export const BAR_GAP = 2;     // between the armour bar and the health bar, and between the top bar and the total
export const DUMMY_LIFT = 12; // the health bar ends this far above the top of the hit zone
export const COVER_LIFT = 4;  // the cover bar ends this far above the top of the piece
export const TOTAL_FONT_SIZE = 14;
/** How far the total reaches above its resting line: the 14 px line plus its 3 px stroke, rounded up. */
export const TOTAL_TEXT_HEIGHT = 20;

export interface DummyReadoutRows {
    healthY: number;     // top of the health bar
    armourY: number;     // top of the armour bar (its place is kept when no armour is drawn)
    totalBottom: number; // the line the total rests on
}

/** The readout rows over a dummy whose hit zone starts at `hitTop`. */
export const dummyReadoutRows = (hitTop: number): DummyReadoutRows => {
    const healthY = hitTop - DUMMY_LIFT - BAR_H;
    const armourY = healthY - BAR_GAP - BAR_H;
    return { healthY, armourY, totalBottom: armourY - BAR_GAP };
};

/** The highest point of a dummy's readout: the top of its total. */
export const dummyReadoutTop = (hitTop: number): number => dummyReadoutRows(hitTop).totalBottom - TOTAL_TEXT_HEIGHT;
