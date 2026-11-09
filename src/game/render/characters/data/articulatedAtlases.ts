// Complete painted parts supply hidden joint surfaces; original heads and tails remain unchanged.
import type { BodyId } from '../../../build/bodyTypes';
import type { SourcePart, XY } from '../artTypes';
import type { AtlasArtData } from '../runtimeDefinitions';

const part = (bounds: readonly [number, number, number, number], origin: XY, axisEnd: XY | undefined,
    pixelScale: number, channel: SourcePart['channel']): SourcePart => {
    const [x, y, right, bottom] = bounds;
    return { polygon: [[x, y], [right, y], [right, bottom], [x, bottom]], origin, axisEnd, pixelScale, channel };
};

export const PART_ATLASES: Partial<Record<BodyId, AtlasArtData>> = {
    human: {
        imagePath: '/assets/characters/atompunk/articulated-v2/human.png', size: [1536, 1024],
        parts: {
            torso: part([0, 0, 384, 490], [196, 545], [196, 130], 0.043, 'torso'),
            pelvis: part([384, 0, 768, 490], [576, 280], [576, -140], 0.043, 'torso'),
            upperArm: part([768, 0, 1152, 490], [957, 128], [946, 395], 0.034, 'arm'),
            forearm: part([1152, 0, 1536, 490], [1347, 120], [1347, 391], 0.034, 'arm'),
            hand: part([0, 512, 384, 1024], [184, 755], undefined, 0.026, 'arm'),
            thigh: part([384, 512, 768, 1024], [578, 592], [568, 906], 0.034, 'leg'),
            shin: part([768, 512, 1152, 1024], [952, 590], [952, 913], 0.033, 'leg'),
            foot: part([1152, 512, 1536, 1024], [1268, 853.21], undefined, 0.038, 'none'),
        },
    },
    'human-female': {
        imagePath: '/assets/characters/atompunk/articulated-v2/human-female.png', size: [1536, 1024],
        parts: {
            torso: part([0, 0, 384, 490], [196, 545], [196, 130], 0.041, 'torso'),
            pelvis: part([384, 0, 768, 490], [576, 280], [576, -140], 0.041, 'torso'),
            upperArm: part([768, 0, 1152, 490], [957, 128], [946, 395], 0.031, 'arm'),
            forearm: part([1152, 0, 1536, 490], [1347, 120], [1347, 391], 0.031, 'arm'),
            hand: part([0, 512, 384, 1024], [184, 755], undefined, 0.026, 'arm'),
            thigh: part([384, 512, 768, 1024], [578, 592], [568, 906], 0.032, 'leg'),
            shin: part([768, 512, 1152, 1024], [952, 590], [952, 913], 0.030, 'leg'),
            foot: part([1152, 512, 1536, 1024], [1268, 852.21], undefined, 0.038, 'none'),
        },
    },
    robot: {
        imagePath: '/assets/characters/atompunk/articulated-v2/robot.png', size: [1536, 1024],
        parts: {
            torso: part([0, 0, 384, 490], [196, 545], [196, 130], 0.043, 'torso'),
            pelvis: part([384, 0, 768, 490], [576, 280], [576, -140], 0.043, 'torso'),
            upperArm: part([768, 0, 1152, 490], [957, 128], [946, 395], 0.033, 'arm'),
            forearm: part([1152, 0, 1536, 490], [1338, 112], [1330, 404], 0.033, 'arm'),
            hand: part([0, 512, 384, 1024], [184, 760], undefined, 0.026, 'arm'),
            thigh: part([384, 512, 768, 1024], [578, 600], [568, 873], 0.034, 'leg'),
            shin: part([768, 512, 1152, 1024], [952, 612], [952, 907], 0.033, 'leg'),
            foot: part([1152, 512, 1536, 1024], [1275, 841.21], undefined, 0.038, 'none'),
        },
    },
    toxic: {
        imagePath: '/assets/characters/atompunk/articulated-v2/toxic.png', size: [1536, 1024],
        parts: {
            torso: part([0, 0, 384, 490], [196, 545], [196, 130], 0.043, 'torso'),
            pelvis: part([384, 0, 768, 490], [576, 280], [576, -140], 0.043, 'torso'),
            upperArm: part([768, 0, 1152, 490], [957, 128], [946, 395], 0.034, 'arm'),
            forearm: part([1152, 0, 1536, 490], [1347, 120], [1347, 391], 0.034, 'arm'),
            hand: part([0, 512, 384, 1024], [184, 755], undefined, 0.026, 'arm'),
            thigh: part([384, 512, 768, 1024], [578, 592], [568, 906], 0.034, 'leg'),
            shin: part([768, 512, 1152, 1024], [952, 590], [952, 913], 0.033, 'leg'),
            foot: part([1152, 512, 1536, 1024], [1268, 842.21], undefined, 0.038, 'none'),
        },
    },
    cat: {
        imagePath: '/assets/characters/atompunk/articulated-v2/cat.png', size: [1536, 1024],
        parts: {
            torso: part([0, 0, 384, 490], [196, 545], [196, 130], 0.043, 'torso'),
            pelvis: part([384, 0, 768, 490], [576, 280], [576, -140], 0.043, 'torso'),
            upperArm: part([768, 0, 1152, 490], [957, 128], [946, 395], 0.034, 'arm'),
            forearm: part([1152, 0, 1536, 490], [1347, 120], [1347, 391], 0.034, 'arm'),
            hand: part([0, 512, 384, 1024], [184, 755], undefined, 0.026, 'arm'),
            thigh: part([384, 512, 768, 1024], [578, 592], [568, 906], 0.034, 'leg'),
            shin: part([768, 512, 1152, 1024], [952, 590], [952, 913], 0.033, 'leg'),
            foot: part([1152, 512, 1536, 1024], [1268, 844.21], undefined, 0.038, 'none'),
        },
    },
};
