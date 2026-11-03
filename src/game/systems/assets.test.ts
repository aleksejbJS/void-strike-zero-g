import { describe, it, expect } from 'vitest';
import { Texture } from 'pixi.js';
import { WeaponType } from '../../types';
import { heldWeaponKey } from '../render/fighter/fighterAnimator';
import { withSharedPictures } from './assets';

describe('held weapon pictures', () => {
    it('a fighter holds the grenade launcher picture for the smoke launcher', () => {
        const grenade = {} as Texture;
        const textures = withSharedPictures({ [heldWeaponKey(WeaponType.GRENADE_LAUNCHER)]: grenade });
        expect(textures[heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]).toBe(grenade);
    });

    it('leaves the smoke launcher without a picture when the grenade launcher has none', () => {
        expect(withSharedPictures({})[heldWeaponKey(WeaponType.SMOKE_LAUNCHER)]).toBeUndefined();
    });
});
