import { Container, Graphics } from 'pixi.js';
import { createRoomState } from '../../net/roomSetup';
import { describe, it, expect } from 'vitest';
import { GameMode, MapId } from '../../../types';
import { createMapLook, themeFor } from './mapLook';
import { rangeTheme } from './themes/rangeTheme';

describe('themeFor', () => {
    it('draws the test range as the bare range look, whatever the map', () => {
        for (const map of Object.values(MapId)) {
            expect(themeFor(GameMode.RANGE, map)).toBe('range');
        }
    });

    it('keeps the other modes on their own looks', () => {
        expect(themeFor(GameMode.DUEL, MapId.PIT)).toBe('pit');
        expect(themeFor(GameMode.HUNGER_GAMES, MapId.HUNGER)).toBe('arena');
        expect(themeFor(GameMode.DEATHMATCH, MapId.TUNNELS)).toBe('mine');
        expect(themeFor(GameMode.DEATHMATCH, MapId.DEFAULT)).toBe('station');
    });
});

describe('rangeTheme', () => {
    it('has no ad places and no decor', () => {
        const theme = rangeTheme();
        expect(theme.adPlaces).toEqual([]);
        expect(theme.decor).toEqual([]);
    });
});

it('keeps the Last Stop scenery behind blood and soot decals', () => {
    const world = new Container();
    const backgroundLayer = new Graphics();
    const decals = new Container();
    const platformLayer = new Graphics();
    world.addChild(backgroundLayer, decals, platformLayer);
    const look = createMapLook({ stage: new Container(), world }, world, { backgroundLayer, platformLayer, cache: {} });
    try {
        look.redraw(createRoomState(GameMode.DEATHMATCH, MapId.LAST_STOP), 1600, 900);
        const backdrop = world.getChildByLabel('last-stop-backdrop');
        expect(backdrop).not.toBeNull();
        expect(world.getChildIndex(backdrop!)).toBeLessThan(world.getChildIndex(decals));
    } finally {
        look.destroy();
        world.destroy({ children: true });
    }
});
