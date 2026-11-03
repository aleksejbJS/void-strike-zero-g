// Turns a player entity into a fighter frame: picks the animation state, advances the run cycle
// by real ground speed and kicks the weapon back when the player fires.

import { Texture } from 'pixi.js';
import { Entity, GameState } from '../../../types';
import { FighterState, RIG_SCALE, solvePose, STRIDE, WALK_STRIDE } from './fighterPose';
import { lookFromEntity } from './fighterLook';
import { gripPoints } from './weaponGrips';
import { FighterFrame } from './fighterView';
import { FighterMotion, headBob, hopLift } from './fighterMotion';
import { DustBudget } from './fighterDust';
import { BleedDrips } from './fighterBleed';
import { stumpTip } from './fighterStump';
import { flashStrength, hasMuzzleFlash } from './muzzleEnvelope';
import { PartMotion, localVelocity } from './parts/partMotion';

const VEL_TO_PX_PER_S = 60;      // Matter measures body velocity per 60 Hz frame
const cyclePx = (stride: number) => 4 * stride * RIG_SCALE; // ground covered by one full step cycle
const MAX_PHASE_SPEED = 24;      // rad/s, keeps very fast slides from blurring the legs
const MOVE_THRESHOLD = 0.5;      // slower than this on the ground is standing
const CRAWL_STRIDE = 3;          // crawling: tiny shuffles
const RUN_SPEED = 3;             // faster than this (~180 px/s) runs, slower walks; a run is ~4
const RECOIL_MS = 160;
const RECOIL_DECAY_MS = 35;
const FALLBACK_ASPECT = 0.23;
const FOOT_PLANT_COS = 0.98;     // the running foot touches down as cos(phase) rises to this

interface AnimMemory {
    phase: number;
    lastTime: number;
    lastFiredSeen: number | null;
    recoilStart: number;
    lastCos: number;          // cos(phase) on the previous frame, to catch the foot plant
    motion: FighterMotion;    // landing squash and hit flash
    dust: DustBudget;
    bleed: BleedDrips;        // blood from the stump of a wounded fighter
    parts: PartMotion;        // springs for tail, ears, lamp and wings
}

export const heldWeaponKey = (type: string) => `held_${type.toLowerCase()}`;

/** Picked from speed, not input, so other players see a walk or a run the same way. */
export const stateOf = (p: Pick<Entity, 'isCrouching' | 'isProne' | 'isGrounded' | 'vel' | 'jetpackOn'>): FighterState => {
    if (p.isProne) return 'prone';
    if (p.isCrouching) return 'crouch';
    if (p.isGrounded) {
        const speed = Math.abs(p.vel.x);
        return speed <= MOVE_THRESHOLD ? 'idle' : speed < RUN_SPEED ? 'walk' : 'run';
    }
    return p.jetpackOn ? 'fly' : 'fall';
};

/** Aim with the fighter turned to face it: returns the facing and the aim as seen facing right. */
export const faceAim = (aim: number) => {
    const facing = Math.abs(aim) > Math.PI / 2 ? -1 : 1;
    let local = facing === 1 ? aim : Math.PI - aim;
    while (local > Math.PI) local -= Math.PI * 2;
    while (local < -Math.PI) local += Math.PI * 2;
    return { facing, local };
};

export class FighterAnimator {
    private readonly memory = new Map<string, AnimMemory>();

    frame(p: Entity, aim: number, now: number, textures: Record<string, Texture | undefined>, game: GameState): FighterFrame {
        const m = this.memoryFor(p.id, now);
        const dt = Math.min(0.1, Math.max(0, (now - m.lastTime) / 1000));
        m.lastTime = now;

        const { facing, local } = faceAim(aim);
        const state = stateOf(p);
        const moveDir = Math.sign(p.vel.x) * facing || 1;
        if (state === 'run' || state === 'walk' || (state === 'prone' && Math.abs(p.vel.x) > MOVE_THRESHOLD / 2)) {
            const stride = state === 'run' ? STRIDE : state === 'walk' ? WALK_STRIDE : CRAWL_STRIDE;
            const rate = (Math.abs(p.vel.x) * VEL_TO_PX_PER_S / cyclePx(stride)) * Math.PI * 2;
            m.phase += Math.min(rate, MAX_PHASE_SPEED) * dt;
        }
        const cosNow = Math.cos(m.phase);
        const footPlanted = state === 'run' && m.lastCos < FOOT_PLANT_COS && cosNow >= FOOT_PLANT_COS;
        m.lastCos = cosNow;

        // A new shot shows up as a changed lastFired (works for remote players too: no clock compare)
        if (m.lastFiredSeen !== null && p.lastFired !== m.lastFiredSeen) m.recoilStart = now;
        m.lastFiredSeen = p.lastFired;
        const since = now - m.recoilStart;
        const recoil = since < RECOIL_MS ? Math.exp(-since / RECOIL_DECAY_MS) : 0;

        const weapon = textures[heldWeaponKey(p.weapon.type)];
        const grip = gripPoints(p.weapon.type, weapon ? weapon.height / weapon.width : FALLBACK_ASPECT);
        const pose = solvePose({ state, aim: local, t: now / 1000, phase: m.phase, moveDir, recoil, grip });

        // Tail, ears and wings answer to the speed along the facing, in px/s, not to the world direction
        const localVel = localVelocity({ x: p.vel.x * VEL_TO_PX_PER_S, y: p.vel.y * VEL_TO_PX_PER_S }, facing);
        const parts = m.parts.update(dt, localVel, state, since);

        const motion = m.motion.observe(p.pos.y, p.health, now);
        if (motion.landed) m.dust.spawnLanding(game, p.pos.x, p.pos.y);
        if (footPlanted) {
            const foot = pose.frontLeg.end;
            m.dust.spawnStep(game, p.pos.x + foot.x * facing * RIG_SCALE, p.pos.y + foot.y * RIG_SCALE, Math.sign(p.vel.x) || facing);
        }
        // A fighter without a leg hops along instead of running, and drips blood from the stump
        const hop = p.wound ? hopLift(state, m.phase, moveDir) : 0;
        if (p.wound) {
            const tip = stumpTip(pose);
            m.bleed.spawn(game, p.pos.x + tip.x * facing * RIG_SCALE, p.pos.y + tip.y * RIG_SCALE - hop, now);
        }
        return {
            pose, grip, weapon, facing,
            weaponType: p.weapon.type,
            look: lookFromEntity(p),
            flame: state === 'fly',
            flicker: Math.random(),
            parts,
            muzzleFlash: hasMuzzleFlash(p.weapon.type) ? flashStrength(since) : 0,
            squash: motion.squash,
            headBob: headBob(state, m.phase),
            hitFlash: motion.hitFlash,
            oneLeg: !!p.wound,
            hop,
        };
    }

    forget(id: string) {
        this.memory.delete(id);
    }

    private memoryFor(id: string, now: number): AnimMemory {
        let m = this.memory.get(id);
        if (!m) {
            m = {
                phase: 0, lastTime: now, lastFiredSeen: null, recoilStart: -Infinity,
                lastCos: 1, motion: new FighterMotion(), dust: new DustBudget(), bleed: new BleedDrips(), parts: new PartMotion(),
            };
            this.memory.set(id, m);
        }
        return m;
    }
}
