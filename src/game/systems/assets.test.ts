import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Texture } from 'pixi.js';
import { WeaponType } from '../../types';
import { heldWeaponKey } from '../render/fighter/fighterAnimator';
import { withSharedPictures } from './assets';

describe('held weapon pictures', () => {
    it('a fighter holds the grenade launcher picture when the smoke launcher one is missing', () => {
        const grenade = {} as Texture;
        const textures = withSharedPictures({ [heldWeaponKey(WeaponType.GRENADE_LAUNCHER)]: grenade });
        expect(textures[heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]).toBe(grenade);
    });

    it('a smoke launcher lying on the map borrows the grenade launcher picture when its own is missing', () => {
        const grenade = {} as Texture;
        const textures = withSharedPictures({ weapon_grenade_launcher: grenade });
        expect(textures.weapon_smoke_launcher).toBe(grenade);
    });

    it('keeps the smoke launcher own pictures when they loaded', () => {
        const grenade = {} as Texture, smoke = {} as Texture;
        const textures = withSharedPictures({
            [heldWeaponKey(WeaponType.GRENADE_LAUNCHER)]: grenade, [heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]: smoke,
            weapon_grenade_launcher: grenade, weapon_smoke_launcher: smoke,
        });
        expect(textures[heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]).toBe(smoke);
        expect(textures.weapon_smoke_launcher).toBe(smoke);
    });

    it('leaves the smoke launcher without a picture when the grenade launcher has none', () => {
        expect(withSharedPictures({})[heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]).toBeUndefined();
    });
});

/** Width, height and colour type from a PNG's IHDR chunk (colour type 6 = RGBA, so it can be transparent). */
const pngHeader = (publicPath: string) => {
    const bytes = readFileSync(resolve(__dirname, '../../../public', publicPath));
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
};

describe('flamethrower pictures', () => {
    it('the HUD and held picture is a trimmed 240 px wide side view with transparency', () => {
        const hud = pngHeader('assets/hud/flamethrower.png');
        expect(hud.width).toBe(240);
        expect(hud.height).toBeGreaterThan(40);
        expect(hud.height).toBeLessThan(110);
        expect(hud.colorType).toBe(6);
    });

    it('the map pickup is a 256x256 picture with transparency', () => {
        expect(pngHeader('assets/items/flamethrower.png')).toEqual({ width: 256, height: 256, colorType: 6 });
    });
});
