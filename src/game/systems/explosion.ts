// Explosions: radial damage to fighters, and to the cover the blast reaches.

import { GameState, Entity, Vector2, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { gameEvents } from './events';
import { distance } from '../utils/math';
import { applyDamage, isTeammate } from './combat';
import { blastBlocks } from '../cover/coverGeometry';
import { blastCover } from '../cover/coverHits';

export interface ExplosionOpts {
    /** The piece of cover the projectile itself hit: it takes the full blast damage, not the falloff. */
    directCoverId?: string;
    /** A barrel blast (accepted here, its hazard rules arrive with the barrel step). */
    barrel?: boolean;
    /** Base damage instead of the weapon's. */
    damage?: number;
}

/**
 * `directId`: the fighter the projectile itself hit; its blast is part of that direct hit, not a splash.
 * Platforms and intact cover shield fighters from the blast; after the fighters, the cover in reach takes it too
 * (so a crate shields whoever stands behind it in the very blast that breaks it).
 */
export const createExplosion = (
    state: GameState, pos: Vector2, ownerId: string, radius: number, weaponType?: WeaponType, directId?: string,
    opts: ExplosionOpts = {},
) => {
    // Looks follow the blast radius; a grenade is drawn a bit smaller than a rocket (cosmetic only)
    const size = (radius / 150) * (weaponType === WeaponType.GRENADE_LAUNCHER ? 0.85 : 1);
    gameEvents.emit({ type: 'EFFECT', effect: 'explosion', x: pos.x, y: pos.y, size });
    gameEvents.emit({ type: 'SOUND', sound: 'explosion' });

    const wepData = weaponType ? WEAPONS_DATA[weaponType] : undefined;
    const baseDamage = opts.damage ?? wepData?.damage ?? 100;

    const owner = state.players.find(o => o.id === ownerId);
    // Walls and cover shield from the blast: hit only if the chest or the feet can "see" the explosion
    const blocked = (to: Vector2) => blastBlocks(state, pos, to);
    const exposed = (p: Entity) => !blocked({ x: p.pos.x, y: p.pos.y - p.height / 2 }) || !blocked({ x: p.pos.x, y: p.pos.y - 2 });

    state.players.forEach(p => {
        if (owner && isTeammate(owner, p)) return;
        if (!exposed(p)) return;
        const dist = distance(pos, p.pos);
        if (dist < radius) {
            const dmg = baseDamage * (1 - dist / radius);
            const kbDir = { x: p.pos.x - pos.x, y: p.pos.y - pos.y };
            applyDamage(state, p, ownerId, dmg, kbDir, wepData?.knockbackForce, { weapon: weaponType, from: pos, direct: p.id === directId });
        }
    });

    blastCover(state, pos, radius, baseDamage, ownerId, Date.now(), opts.directCoverId);
};
