import { describe, it, expect } from 'vitest';
import { GameMode, MapId } from '../../../types';
import { themeFor } from './mapLook';
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
