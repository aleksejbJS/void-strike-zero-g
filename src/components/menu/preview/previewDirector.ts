// Plays a mode script into a GameState at the physics tick rate, so the game's own renderer
// can draw it: actors follow their keys, switch weapons, carry flags, fire real projectiles,
// bleed, die into corpses and respawn; props (flags, intel) lie on the map until picked up.
// Particles, corpses and floating texts age exactly as in a match.

import { Entity, GameMode, GameState, MapId, Pickup, Vector2 } from '../../../types';
import { PHYSICS_TICK_RATE, WEAPONS_DATA } from '../../../constants';
import { applyEffectEvent, deathEvent, jetpackTrail } from '../../../game/systems/effects';
import { updateFloatingTexts, updateParticles } from '../../../game/systems/particles';
import { updateCorpses } from '../../../game/systems/ragdoll/corpses';
import {
    ActorScript, aimTargetAt, carriedAt, crossed, isDeadAt, isPropHidden, ModeScript, sampleActor, weaponAt, zoneAt,
} from './previewScript';
import { actorEntityId, createActorEntity, createPreviewState, YouLook } from './previewWorld';
import { chestOf, createShots, shoulderOf } from './previewShots';

const TICK_S = 1 / PHYSICS_TICK_RATE;
const VEL_SCALE = 1 / 60;   // entity velocity is measured per 60 Hz frame
const TEXT_ABOVE = 90;
const SCORE_COLOR = '#FFC21A';

export interface PreviewDirector {
    readonly state: GameState;
    /** Advance one physics tick. */
    tick(now: number): void;
}

export const createDirector = (script: ModeScript, mode: GameMode, map: MapId, you: YouLook): PreviewDirector => {
    const state = createPreviewState(mode, map);
    state.players = script.actors.map(a => createActorEntity(a.id, a.look, a.team, a.weapon, you));
    const entities = new Map<string, Entity>(script.actors.map(a => [a.id, state.players.find(p => p.id === actorEntityId(a.id))!]));
    const entityOf = (id: string) => entities.get(id)!;
    state.pickups = (script.props ?? []).map((p): Pickup => ({
        id: `pv-${p.id}`, type: p.type, team: p.team, pos: { ...p.pos }, active: true, respawnTime: 0, value: 0,
    }));
    const shots = createShots(state);
    let t = 0;

    const aimOf = (a: ActorScript, from: Vector2, facingRight: boolean) => {
        const target = aimTargetAt(a, t);
        const point = typeof target === 'string' ? chestOf(entityOf(target)) : target;
        if (!point) return facingRight ? 0 : Math.PI;
        return Math.atan2(point.y - from.y, point.x - from.x);
    };

    const placeActor = (a: ActorScript, p: Entity) => {
        const s = sampleActor(a, t);
        p.pos = s.pos;
        p.vel = { x: s.vel.x * VEL_SCALE, y: s.vel.y * VEL_SCALE };
        p.isGrounded = s.move === 'ground';
        p.jetpackOn = s.move === 'jet';
        if (Math.abs(s.vel.x) > 1) p.facingRight = s.vel.x > 0;
        p.aim = aimOf(a, shoulderOf(p), p.facingRight);
        p.facingRight = Math.abs(p.aim) <= Math.PI / 2;
        p.hasFlag = carriedAt(a, t);
        const weapon = weaponAt(a, t);
        if (p.weapon.type !== weapon) p.weapon = { ...WEAPONS_DATA[weapon] };
        if (p.jetpackOn) jetpackTrail(state, p);
    };

    const floatText = (over: Entity, text: string, color = SCORE_COLOR) =>
        applyEffectEvent(state, { type: 'FLOAT_TEXT', x: over.pos.x - 10, y: over.pos.y - TEXT_ABOVE, text, color });

    const respawnFlash = (a: ActorScript, p: Entity) => {
        p.health = p.maxHealth;
        const at = sampleActor(a, t).pos;
        applyEffectEvent(state, { type: 'EFFECT', effect: 'respawn', x: at.x, y: at.y - 36 });
    };

    const runEvents = (from: number, to: number, now: number) => {
        script.actors.forEach(a => {
            const p = entityOf(a.id);
            a.shots?.forEach(s => { if (crossed(s.t, from, to)) shots.fire(p, entityOf(s.target), s.hit, now); });
            if (a.death && crossed(a.death.at, from, to)) {
                applyEffectEvent(state, deathEvent(p));
                floatText(entityOf(a.death.killer), '+1');
            }
            if (a.death && crossed(a.death.respawn, from, to)) respawnFlash(a, p);
            if (a.hide && crossed(a.hide.to, from, to)) respawnFlash(a, p);
        });
        script.texts?.forEach(x => { if (crossed(x.t, from, to)) floatText(entityOf(x.actor), x.text, x.color); });
    };

    return {
        state,
        tick(now) {
            const from = t;
            t = (t + TICK_S) % script.duration;
            if (t < from) state.decals = []; // a new loop: blood stains of the last one go
            runEvents(from, t, now);
            script.actors.forEach(a => {
                const p = entityOf(a.id);
                p.dead = isDeadAt(a, t);
                if (!p.dead) placeActor(a, p);
            });
            script.props?.forEach((prop, i) => { state.pickups[i].active = !isPropHidden(prop, t); });
            if (script.zone) state.hungerZone = zoneAt(script.zone, t, script.duration);
            shots.tick();
            updateParticles(state);
            updateCorpses(state);
            updateFloatingTexts(state);
        },
    };
};
