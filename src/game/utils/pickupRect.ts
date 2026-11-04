// A pickup's collection box (pos = centre-x, bottom-y): flags are tall (pole + cloth), others are small cubes.

import { ItemType, Pickup } from '../../types';

export const pickupRect = (item: Pickup): { x: number; y: number; w: number; h: number } => {
    const w = item.type === ItemType.FLAG ? 80 : 40;
    const h = item.type === ItemType.FLAG ? 100 : 40;
    return { x: item.pos.x - w / 2, y: item.pos.y - h, w, h };
};
