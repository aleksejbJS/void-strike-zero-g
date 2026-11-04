import { beforeEach, describe, expect, it } from 'vitest';
import { GameMode } from '../../types';
import type { GameState, ParticleKind } from '../../types';
import { createMockState } from '../../test/mocks';
import { COVER_SPECS, CoverKind } from '../cover/coverTypes';
import type { CoverEvent } from './events';
import { applyEffectEvent } from './effects';
import { applyCoverEvent } from './coverEffects';

const GLASS_TINTS = ['#afe8ff', '#cdf3ff'];

let state: GameState;
beforeEach(() => { state = createMockState(GameMode.DEATHMATCH); });

const event = (kind: CoverKind, action: CoverEvent['action'], x = 400, y = 300): CoverEvent => ({ type: 'COVER', action, kind, x, y });
const kinds = (): Set<ParticleKind | undefined> => new Set(state.particles.map(p => p.type));

describe('applyCoverEvent', () => {
    it.each(['wood', 'metal', 'glass'] as const)('a broken %s piece throws many pieces around its middle', kind => {
        applyCoverEvent(state, event(kind, 'break'));
        expect(state.particles.length).toBeGreaterThanOrEqual(12);
        const { w, h } = COVER_SPECS[kind];
        for (const p of state.particles) {
            expect(Math.abs(p.pos.x - 400)).toBeLessThanOrEqual(w / 2 + 1);
            expect(Math.abs(p.pos.y - 300)).toBeLessThanOrEqual(h / 2 + 1);
        }
    });

    it('a broken wood crate adds splinters and a cloud of dust', () => {
        applyCoverEvent(state, event('wood', 'break'));
        expect(kinds()).toContain('smoke');
        expect(state.particles.some(p => p.color === '#e2b27c')).toBe(true);
    });

    it('a broken metal crate adds hot chunks and sparks', () => {
        applyCoverEvent(state, event('metal', 'break'));
        expect(kinds()).toContain('debris');
        expect(kinds()).toContain('spark');
    });

    it('broken glass adds shards in the glass tints', () => {
        applyCoverEvent(state, event('glass', 'break'));
        // each shard takes one of the two tints at random: count both, there are 26 shards whatever the rolls
        expect(state.particles.filter(p => GLASS_TINTS.includes(p.color))).toHaveLength(26);
    });

    it('a broken barrel adds nothing: the blast has its own effect', () => {
        applyCoverEvent(state, event('barrel', 'break'));
        expect(state.particles).toHaveLength(0);
    });

    it('a hit wood crate spits a few chips', () => {
        applyCoverEvent(state, event('wood', 'hit'));
        expect(state.particles.length).toBeGreaterThanOrEqual(2);
        expect(state.particles.length).toBeLessThan(12);
    });

    it.each(['metal', 'barrel'] as const)('a hit %s piece throws sparks', kind => {
        applyCoverEvent(state, event(kind, 'hit'));
        expect(kinds()).toContain('spark');
    });

    it('a hit glass panel loses a few shards', () => {
        applyCoverEvent(state, event('glass', 'hit'));
        expect(state.particles.length).toBeGreaterThanOrEqual(2);
    });

    it('a piece coming back flashes in hazard yellow', () => {
        applyCoverEvent(state, event('wood', 'restore'));
        expect(state.particles).toHaveLength(1);
        expect(state.particles[0]).toMatchObject({ type: 'flash', color: '#ffc21a' });
    });

    it('applyEffectEvent hands COVER events over', () => {
        applyEffectEvent(state, event('metal', 'break'));
        expect(state.particles.length).toBeGreaterThan(0);
    });

    it('never touches anything but particles', () => {
        applyCoverEvent(state, event('wood', 'break'));
        expect(state.floatingTexts).toHaveLength(0);
        expect(state.decals).toHaveLength(0);
    });
});
