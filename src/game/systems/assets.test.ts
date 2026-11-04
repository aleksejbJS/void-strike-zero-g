import { describe, it, expect } from 'vitest';
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
