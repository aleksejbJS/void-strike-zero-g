import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { UIProvider, useUIStore } from './uiStore';

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

let saved: Record<string, string>;

beforeEach(() => {
    saved = {};
    (localStorage.getItem as Mock).mockReset().mockImplementation((key: string) => (key in saved ? saved[key] : null));
});

describe('uiStore reloadPlayer', () => {
    it('re-reads name, skin and all colours from storage', () => {
        render(<UIProvider><Spy /></UIProvider>);
        saved = {
            playerName: 'Zed', selectedSkin: 'robot', playerColor: '#010101', torsoColor: '#020202', headColor: '#030303',
            armColor: '#040404', legColor: '#050505', jetpackColor: '#060606',
        };
        act(() => store.actions.reloadPlayer());
        expect(store.state).toMatchObject({
            playerName: 'Zed', selectedSkin: 'robot', playerColor: '#010101', torsoColor: '#020202', headColor: '#030303',
            armColor: '#040404', legColor: '#050505', jetpackColor: '#060606',
        });
    });

    it('falls back to the game defaults for anything not stored', () => {
        render(<UIProvider><Spy /></UIProvider>);
        saved = { playerColor: '#112233' };
        act(() => store.actions.reloadPlayer());
        expect(store.state).toMatchObject({
            playerName: 'Anonymous', selectedSkin: 'classic', playerColor: '#112233', headColor: '#112233',
            torsoColor: '#112233', armColor: '#112233', legColor: '#475569', jetpackColor: '#ef4444',
        });
        saved = {};
        act(() => store.actions.reloadPlayer());
        expect(store.state).toMatchObject({ playerColor: '#3b82f6', headColor: '#3b82f6' });
    });

    it('does not touch the rest of the state', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.toggleMute());
        act(() => store.actions.reloadPlayer());
        expect(store.state.isMuted).toBe(true);
    });
});

describe('uiStore saving the player', () => {
    let written: Record<string, string>;
    beforeEach(() => {
        written = {};
        (localStorage.setItem as Mock).mockReset().mockImplementation((key: string, value: string) => { written[key] = value; });
    });
    afterEach(() => { (localStorage.setItem as Mock).mockReset(); });

    it('selectSkin and setPlayerCustomization write the usual keys, the player colour being the torso colour', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.selectSkin('wolf'));
        act(() => store.actions.setPlayerCustomization('Ace', { torso: '#010101', head: '#020202', arms: '#030303', legs: '#040404', jetpack: '#050505' }));
        expect(written).toEqual({
            selectedSkin: 'wolf', playerName: 'Ace', playerColor: '#010101', torsoColor: '#010101',
            headColor: '#020202', armColor: '#030303', legColor: '#040404', jetpackColor: '#050505',
        });
        expect(store.state).toMatchObject({ selectedSkin: 'wolf', playerName: 'Ace', jetpackColor: '#050505' });
    });

    it('a storage failure is logged and the state still updates', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (localStorage.setItem as Mock).mockImplementation(() => { throw new Error('quota'); });
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.selectSkin('wolf'));
        expect(store.state.selectedSkin).toBe('wolf');
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
