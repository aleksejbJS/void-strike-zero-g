// Shots in a mode preview, drawn with the game's projectile and beam views: bullets, shotgun
// pellets, rockets and plasma fly to their target and land with blood or a blast; the railgun
// is an instant beam. Hits only flash and bleed — deaths come from the script.

import { Entity, GameState, Projectile, Vector2, WeaponType } from '../../../types';
import { applyEffectEvent, explosionBurst } from '../../../game/systems/effects';
import { nextId } from '../../../game/utils/id';

const SHOULDER = 49;        // weapon height above the feet
const MUZZLE = 30;          // weapon reach in front of the shoulder
const CHEST = 40;           // where shots land on a target
const HIT_DAMAGE = 25;
const MISS_SPREAD = 60;     // a miss passes this far above the target
const MISS_RANGE = 1400;
const PELLETS = 5;
const PELLET_SPREAD = 0.12; // radians
const BEAM_FADE = 0.05;     // beam life lost per tick, as in a match
const BLAST_WEAPONS = new Set([WeaponType.ROCKET_LAUNCHER, WeaponType.GRENADE_LAUNCHER]);

interface Flight {
    proj: Projectile;
    left: number;      // ticks until it lands
    target?: string;   // entity id hit on landing
}

export const shoulderOf = (p: Pick<Entity, 'pos'>): Vector2 => ({ x: p.pos.x, y: p.pos.y - SHOULDER });

export const chestOf = (p: Pick<Entity, 'pos'>): Vector2 => ({ x: p.pos.x, y: p.pos.y - CHEST });

export const createShots = (state: GameState) => {
    let flights: Flight[] = [];

    const hurt = (victim: Entity | undefined, at: Vector2) => {
        if (!victim || victim.dead) return;
        victim.health = Math.max(1, victim.health - HIT_DAMAGE);
        applyEffectEvent(state, { type: 'EFFECT', effect: 'blood', x: at.x, y: at.y, color: victim.color, count: 6 });
    };

    const launch = (shooter: Entity, dir: number, dist: number, target?: Entity) => {
        const from = shoulderOf(shooter);
        const muzzle = { x: from.x + Math.cos(dir) * MUZZLE, y: from.y + Math.sin(dir) * MUZZLE };
        const speed = shooter.weapon.speed;
        flights.push({
            proj: {
                id: nextId('pvp_'), ownerId: shooter.id, type: shooter.weapon.type, radius: 4, active: true,
                pos: muzzle, vel: { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed },
            },
            left: Math.max(1, Math.round((dist - MUZZLE) / speed)),
            target: target?.id,
        });
    };

    const beam = (shooter: Entity, end: Vector2, target?: Entity) => {
        state.beams.push({ id: nextId('pvb_'), start: shoulderOf(shooter), end, color: '#60a5fa', life: 1, width: 4 });
        hurt(target, end);
    };

    return {
        /** `shooter` fires at `target`; a miss flies over its head. */
        fire(shooter: Entity, target: Entity, hit: boolean, now: number) {
            if (shooter.dead) return;
            shooter.lastFired = now;
            const from = shoulderOf(shooter);
            const aim = { x: target.pos.x, y: target.pos.y - CHEST - (hit ? 0 : MISS_SPREAD) };
            const dir = Math.atan2(aim.y - from.y, aim.x - from.x);
            const dist = hit ? Math.hypot(aim.x - from.x, aim.y - from.y) : MISS_RANGE;
            const type = shooter.weapon.type;
            if (type === WeaponType.RAILGUN) {
                beam(shooter, hit ? aim : { x: from.x + Math.cos(dir) * dist, y: from.y + Math.sin(dir) * dist }, hit ? target : undefined);
            } else if (type === WeaponType.SHOTGUN) {
                for (let i = 0; i < PELLETS; i++) {
                    const spread = (i - (PELLETS - 1) / 2) * PELLET_SPREAD;
                    launch(shooter, dir + spread, dist, hit && i === (PELLETS - 1) / 2 ? target : undefined);
                }
            } else {
                launch(shooter, dir, dist, hit ? target : undefined);
            }
        },

        tick() {
            flights.forEach(f => {
                f.proj.pos = { x: f.proj.pos.x + f.proj.vel.x, y: f.proj.pos.y + f.proj.vel.y };
                f.left--;
                if (f.left > 0) return;
                if (BLAST_WEAPONS.has(f.proj.type)) explosionBurst(state, f.proj.pos.x, f.proj.pos.y);
                if (f.target) hurt(state.players.find(p => p.id === f.target), f.proj.pos);
            });
            flights = flights.filter(f => f.left > 0);
            state.projectiles = flights.map(f => f.proj);
            state.beams.forEach(b => { b.life -= BEAM_FADE; });
            state.beams = state.beams.filter(b => b.life > 0);
        },
    };
};
