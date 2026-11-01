import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyEffectEvent } from './effects';
import { applyDamage, createExplosion, fireWeapon } from './combat';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

describe('simulation announces effects instead of drawing them', () => {
    it('damage and death become events, state stays free of cosmetics', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 100, y: 200 };
        p.health = 10;
        state.players.push(p);

        applyDamage(state, p, '', 50, { x: 1, y: 0 });

        expect(events).toContainEqual({ type: 'DAMAGE', x: 100, y: 160, amount: 50 });
        expect(events).toContainEqual(expect.objectContaining({ type: 'DEATH', x: 100, y: 200, color: p.color, height: p.height }));
        const death = events.find(e => e.type === 'DEATH');
        expect(death && 'parts' in death && death.parts?.torso).toBe(p.torsoColor || p.color);
        expect(state.particles).toHaveLength(0);
        expect(state.floatingTexts).toHaveLength(0);
        expect(state.ragdollParts).toHaveLength(0);
    });

    it('explosions and shots announce their effects', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.MACHINE_GUN);
        state.players.push(shooter);

        createExplosion(state, { x: 5, y: 6 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        fireWeapon(state, shooter, { x: 100, y: 0 });

        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'explosion' && e.x === 5)).toBe(true);
        expect(events.some(e => e.type === 'EFFECT' && e.effect === 'shell')).toBe(true);
    });
});

describe('applyEffectEvent', () => {
    it('draws a death as blood, a decal and a ragdoll', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DEATH', x: 10, y: 20, color: '#ff0000', height: 72 });
        expect(state.particles.length).toBe(40);
        expect(state.decals.length).toBe(1);
        expect(state.ragdollParts.length).toBe(6);
    });

    it('shows damage numbers and texts', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'DAMAGE', x: 0, y: 0, amount: 25 });
        applyEffectEvent(state, { type: 'FLOAT_TEXT', x: 0, y: 0, text: '+1', color: '#00ff00' });
        expect(state.floatingTexts.map(t => t.text)).toEqual(['25', '+1']);
    });

    it('ignores non-visual events', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'SOUND', sound: 'hit' });
        expect(state.particles).toHaveLength(0);
    });
});
