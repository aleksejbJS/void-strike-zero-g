import type { Platform } from '../../../../types';
import type { LastStopArt } from './artAssets';
import { paintArchitecture } from './architecture';
import { paintAtmosphere } from './atmosphere';
import { paintSurfaces } from './surfaces';

export const paintLastStopWorld = (ctx: CanvasRenderingContext2D, art: LastStopArt, platforms: Platform[]) => {
    paintAtmosphere(ctx, art.dusk);
    paintArchitecture(ctx, art);
    paintSurfaces(ctx, art, platforms);
};
