import type { SourcePart, XY } from '../artTypes';

const SIZE: XY = [1254, 1254];

/** UV cell and bone pivots refer to the inspected, unmodified generated picture. */
export const humanPosePart = (pose: 'crouch' | 'prone', bounds: readonly [number, number, number, number], origin: XY,
    axisEnd: XY | undefined, pixelScale: number, channel: SourcePart['channel'], supportHeight?: number): SourcePart => ({
    polygon: [[bounds[0], bounds[1]], [bounds[2], bounds[1]],
        [bounds[2], bounds[3]], [bounds[0], bounds[3]]],
    origin, axisEnd, pixelScale, channel, supportHeight,
    image: { imagePath: `/assets/characters/atompunk/human-v3/${pose}.png`, size: SIZE },
});
