import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, Mock } from 'vitest';
import { DEFAULT_BUILD } from '../../../game/build/buildParts';
import { useFighterDraft } from './useFighterDraft';

const legacyColors = { torso: '#3b82f6', head: '#3b82f6', arms: '#3b82f6', legs: '#475569', jetpack: '#ef4444' };
let saved: Record<string, string>;

beforeEach(() => {
    saved = {};
    (localStorage.getItem as Mock).mockImplementation((key: string) => saved[key] ?? null);
});

describe('useFighterDraft illustrated bases', () => {
    it('migrates an untouched legacy default into the human art and neutral palette', () => {
        const { result } = renderHook(() => useFighterDraft('classic', legacyColors));
        expect(result.current.preset.id).toBe('base-human');
        expect(result.current.build).toMatchObject({ body: 'human', helmet: 'none', visor: 'none' });
        expect(result.current.colors).toEqual({
            head: '#a56b47', torso: '#e4d4ab', arms: '#a56b47', legs: '#514d42', jetpack: '#ef4444',
        });
        expect(result.current.changed).toBe(false);
    });

    it.each([['cyborg', 'base-robot'], ['wolf', 'base-cat'], ['toxic', 'base-toxic']])(
        'maps legacy %s to %s', (id, expected) => {
            saved.selectedSkin = id;
            const { result } = renderHook(() => useFighterDraft(id, legacyColors));
            expect(result.current.preset.id).toBe(expected);
        },
    );

    it('retains custom body colors, unlocked gear and XP during migration', () => {
        saved.fighterXp = '5000';
        saved.fighterBuild = JSON.stringify({ ...DEFAULT_BUILD, helmet: 'angular', tail: 'mech', visorColor: '#123456' });
        const colors = { ...legacyColors, arms: '#123456', jetpack: '#654321' };
        const { result } = renderHook(() => useFighterDraft('classic', colors));
        expect(result.current.build).toMatchObject({ body: 'human', helmet: 'angular', tail: 'mech', visorColor: '#123456' });
        expect(result.current.colors).toMatchObject({ arms: '#123456', jetpack: '#654321' });
        expect(saved.fighterXp).toBe('5000');
        expect(result.current.changed).toBe(true);
    });

    it('preserves an explicitly saved blue head as a custom color', () => {
        saved.headColor = '#3b82f6';
        saved.fighterBuild = JSON.stringify(DEFAULT_BUILD);
        const { result } = renderHook(() => useFighterDraft('classic', legacyColors));
        expect(result.current.colors.head).toBe('#3b82f6');
        expect(result.current.colors.torso).toBe('#e4d4ab');
        expect(result.current.changed).toBe(true);
    });

    it('uses saved body identity over a stale selected skin and retains its custom gear', () => {
        saved.fighterBuild = JSON.stringify({ ...DEFAULT_BUILD, body: 'cat', helmet: 'box' });
        const { result } = renderHook(() => useFighterDraft('classic', legacyColors));
        expect(result.current.preset.id).toBe('base-cat');
        expect(result.current.build).toMatchObject({ body: 'cat', helmet: 'box' });
    });

    it('cycles only the five bases and applies neutral colors after each repeated selection', () => {
        const { result } = renderHook(() => useFighterDraft('classic', legacyColors));
        act(() => result.current.stepPreset(1));
        expect(result.current.preset.id).toBe('base-female');
        expect(result.current.build).toMatchObject({ body: 'human-female', helmet: 'none', visor: 'none' });
        act(() => { result.current.stepPreset(1); result.current.stepPreset(1); result.current.stepPreset(1); });
        expect(result.current.preset.id).toBe('base-cat');
        act(() => result.current.stepPreset(1));
        expect(result.current.preset.id).toBe('base-human');
        expect(result.current.changed).toBe(false);
        expect(result.current.colors.torso).toBe('#e4d4ab');
    });

    it('marks a body-only edit as changed', () => {
        const { result } = renderHook(() => useFighterDraft('classic', legacyColors));
        act(() => result.current.patchBuild({ body: 'robot' }));
        expect(result.current.changed).toBe(true);
    });
});
