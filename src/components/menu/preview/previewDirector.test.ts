import { describe, expect, it } from 'vitest';
import { GameMode, MapId, Team, WeaponType } from '../../../types';
import { PHYSICS_TICK_RATE } from '../../../constants';
import { presetBuild } from '../../../game/build/buildPresets';
import { createDirector } from './previewDirector';
import { deathmatchScript } from './scripts/deathmatch';
import { actorEntityId } from './previewWorld';
import { ModeScript } from './previewScript';
import { ctfScript } from './scripts/ctf';
import { gunGameScript } from './scripts/gunGame';
import { hungerScript } from './scripts/hunger';
import { clearMarks, liveMarks } from '../../../game/systems/marks';

const you = { head: '#ffffff', torso: '#ffffff', arms: '#ffffff', legs: '#475569', jetpack: '#ef4444', skinId: 'classic', build: presetBuild('classic') };

const runUntil = (seconds: number) => {
    const d = createDirector(deathmatchScript, GameMode.DEATHMATCH, MapId.DEFAULT, you);
    const ticks = Math.round(seconds * PHYSICS_TICK_RATE);
    for (let i = 0; i < ticks; i++) d.tick(1000 + i * 8);
    return d;
};

const red = (d: ReturnType<typeof runUntil>) => d.state.players.find(p => p.id === actorEntityId('red'))!;

describe('preview director', () => {
    it('fires real projectiles while you shoot', () => {
        const d = runUntil(1.05);
        expect(d.state.projectiles.some(p => p.ownerId === actorEntityId('you'))).toBe(true);
    });

    it('kills the red bot into a ragdoll with a +1 over you', () => {
        const d = runUntil(2.0);
        expect(red(d).dead).toBe(true);
        expect(d.state.ragdollParts.length).toBeGreaterThan(0);
        expect(d.state.floatingTexts.some(t => t.text === '+1')).toBe(true);
    });

    it('respawns the red bot healed', () => {
        const d = runUntil(3.5);
        expect(red(d).dead).toBe(false);
        expect(red(d).health).toBe(100);
    });

    it('shows you flying with the jetpack', () => {
        const d = runUntil(0.9);
        const me = d.state.players.find(p => p.id === actorEntityId('you'))!;
        expect(me.jetpackOn).toBe(true);
        expect(me.isGrounded).toBe(false);
    });

    it('starts the next loop clean', () => {
        const d = runUntil(5.05);
        expect(d.state.decals).toHaveLength(0);
        expect(red(d).dead).toBe(false);
    });
});

const play = (script: ModeScript, mode: GameMode, seconds: number) => {
    const d = createDirector(script, mode, MapId.DEFAULT, you);
    for (let i = 0; i < Math.round(seconds * PHYSICS_TICK_RATE); i++) d.tick(1000 + i * 8);
    return d;
};
const actor = (d: ReturnType<typeof play>, id: string) => d.state.players.find(p => p.id === actorEntityId(id))!;

describe('preview director, objective modes', () => {
    it('Capture the Flag: the red flag leaves its base on your back', () => {
        const d = play(ctfScript, GameMode.CTF, 2);
        expect(actor(d, 'you').hasFlag).toBe(Team.RED);
        expect(d.state.pickups.find(p => p.team === Team.RED)?.active).toBe(false);
        expect(d.state.pickups.find(p => p.team === Team.BLUE)?.active).toBe(true);
    });

    it('Gun Game: you hold the weapon of your rung', () => {
        expect(actor(play(gunGameScript, GameMode.GUN_GAME, 2), 'you').weapon.type).toBe(WeaponType.ROCKET_LAUNCHER);
        expect(actor(play(gunGameScript, GameMode.GUN_GAME, 3.6), 'you').weapon.type).toBe(WeaponType.RAILGUN);
    });

    it('Gun Game: the railgun draws a beam', () => {
        expect(play(gunGameScript, GameMode.GUN_GAME, 3.82).state.beams.length).toBeGreaterThan(0);
    });

    it('Hunger Games: the zone closes in', () => {
        const d = play(hungerScript, GameMode.HUNGER_GAMES, 4);
        expect(d.state.hungerZone!.w).toBeLessThan(hungerScript.zone!.wide.w);
    });

    it('leaves no scorch marks behind for the next match (rockets included)', () => {
        clearMarks();
        play(gunGameScript, GameMode.GUN_GAME, 6);
        expect(liveMarks(Date.now())).toHaveLength(0);
    });
});
