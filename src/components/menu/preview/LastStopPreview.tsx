import React, { useEffect, useRef } from 'react';
import { GameMode, MapId } from '../../../types';
import { getCoverLayout } from '../../../game/cover/coverLayout';
import { drawFuelPump } from '../../../game/render/cover/fuelPumpArt';
import { getPlatforms } from '../../../game/data/level';
import { LAST_STOP_ART_HEIGHT, LAST_STOP_WIDTH } from '../../../game/data/lastStop/layout';
import { loadLastStopArt } from '../../../game/render/scene/lastStop/artAssets';
import { paintLastStopWorld } from '../../../game/render/scene/lastStop/paintWorld';

const WIDTH = 1120;
const SCALE = WIDTH / LAST_STOP_WIDTH;

export const LastStopPreview = () => {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        let active = true;
        loadLastStopArt().then(art => {
            if (!active) return;
            const ctx = canvas.current?.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D is not available for the Last Stop preview');
            ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
            paintLastStopWorld(ctx, art, getPlatforms(GameMode.DEATHMATCH, MapId.LAST_STOP));
            for (const c of getCoverLayout(GameMode.DEATHMATCH, MapId.LAST_STOP)) {
                if (c.kind === 'fuel-pump') drawFuelPump(ctx, c.pos.x, c.pos.y, 0, 11);
            }
        }).catch((error: unknown) => {
            if (active) console.error('Could not draw the Last Stop preview.', error);
        });
        return () => { active = false; };
    }, []);

    return <canvas ref={canvas} className="absolute inset-0 m-auto h-auto w-full" width={WIDTH}
        height={Math.ceil(LAST_STOP_ART_HEIGHT * SCALE)} />;
};
