import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { installAccountHarness } from '../../test/accountHarness';
import { mountProfile } from '../../test/profileKit';

describe('ProfileScreen controls tab', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.unstubAllGlobals(); });

    const slot = (action: string, n: 1 | 2) => screen.getByRole('button', { name: new RegExp(`^${action.replace(/[()]/g, '\\$&')}, slot ${n}:`) });
    const openControls = async () => {
        const view = await mountProfile(h);
        fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
        return view;
    };
    const stored = () => JSON.parse(h.store['controls.v1']).bindings;

    it('opens on the achievements, the Controls tab lists the actions with their keys', async () => {
        await mountProfile(h);
        expect(screen.getByRole('tab', { name: 'Achievements' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
        expect(slot('Jetpack (up)', 1)).toHaveTextContent('W');
        expect(slot('Jetpack (up)', 2)).toHaveTextContent('Space');
        expect(screen.queryByRole('list', { name: 'Achievements' })).not.toBeInTheDocument();
    });

    it('binds the next key pressed and saves it', async () => {
        await openControls();
        fireEvent.click(slot('Jetpack (up)', 1));
        expect(slot('Jetpack (up)', 1)).toHaveTextContent('Press a key…');
        fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
        expect(slot('Jetpack (up)', 1)).toHaveTextContent('E');
        expect(stored().jetpack).toEqual(['KeyE', 'Space']);
    });

    it('moves a key taken by another action, marks the emptied slot and warns', async () => {
        await openControls();
        fireEvent.click(slot('Right', 1));
        fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
        expect(slot('Right', 1)).toHaveTextContent('A');
        expect(slot('Left', 1)).toHaveTextContent('—');
        expect(slot('Left', 1)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('No key for: Left');
    });

    it('Escape cancels the capture and leaves the profile open', async () => {
        const { onBack } = await openControls();
        fireEvent.click(slot('Jetpack (up)', 1));
        fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
        expect(slot('Jetpack (up)', 1)).toHaveTextContent('W');
        expect(onBack).not.toHaveBeenCalled();
    });

    it('keeps waiting through a reserved key', async () => {
        await openControls();
        fireEvent.click(slot('Jetpack (up)', 1));
        fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
        expect(slot('Jetpack (up)', 1)).toHaveTextContent('Press a key…');
    });

    it('binds a mouse button', async () => {
        await openControls();
        fireEvent.click(slot('Fire', 2));
        fireEvent.mouseDown(window, { button: 1 });
        expect(slot('Fire', 2)).toHaveTextContent('MMB');
        // The button's own click is swallowed, then the page takes clicks again
        fireEvent.mouseUp(window, { button: 1 });
        fireEvent.click(slot('Fire', 2));
        expect(slot('Fire', 2)).toHaveTextContent('MMB');
        act(() => { vi.runOnlyPendingTimers(); });
        fireEvent.click(slot('Fire', 2));
        expect(slot('Fire', 2)).toHaveTextContent('Press a key…');
    });

    it('clears a secondary slot', async () => {
        await openControls();
        fireEvent.click(screen.getByRole('button', { name: 'Clear Grapple, slot 2' }));
        expect(slot('Grapple', 2)).toHaveTextContent('—');
        expect(stored().grapple).toEqual(['Mouse2', null]);
    });

    it('Reset all brings the defaults back', async () => {
        await openControls();
        fireEvent.click(slot('Right', 1));
        fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
        fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
        expect(slot('Left', 1)).toHaveTextContent('A');
        expect(slot('Right', 1)).toHaveTextContent('D');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('has no Controls tab on a device without a mouse or trackpad', async () => {
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
        await mountProfile(h);
        expect(screen.queryByRole('tab', { name: 'Controls' })).not.toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Achievements' })).toBeInTheDocument();
    });
});
