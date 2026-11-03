import React from 'react';
import { describe, it, expect, beforeEach, Mock } from 'vitest';
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
