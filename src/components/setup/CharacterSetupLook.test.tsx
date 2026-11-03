import React from 'react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UIProvider } from '../../store/uiStore';
import CharacterSetup from './CharacterSetup';

vi.mock('./CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

let store: Record<string, string>;
const setItem = localStorage.setItem as Mock;
const stampWrites = () => setItem.mock.calls.filter(([key]) => key === 'fighterLookSavedAt').length;

const startMatch = () => {
    render(<UIProvider><CharacterSetup onContinue={vi.fn()} onBack={vi.fn()} /></UIProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
    cleanup();
};

beforeEach(() => {
    // Back the global localStorage mocks with a plain object so a second visit sees what the first one saved.
    store = {};
    (localStorage.getItem as Mock).mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
    setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
});

describe('CharacterSetup look stamp', () => {
    it('the first Start stamps the look and stores the player colour as the torso colour', () => {
        startMatch();
        expect(stampWrites()).toBe(1);
        expect(Number(store.fighterLookSavedAt)).toBeGreaterThan(0);
        expect(store.playerColor).toBe(store.torsoColor);
        expect(JSON.parse(store.fighterBuild)).toHaveProperty('helmet');
    });

    it('starting again without any change does not stamp the look again', () => {
        startMatch();
        const stamp = store.fighterLookSavedAt;
        startMatch();
        expect(stampWrites()).toBe(1);
        expect(store.fighterLookSavedAt).toBe(stamp);
    });
});
