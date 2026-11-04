import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { ALEX, deferred, installAccountHarness } from '../../test/accountHarness';
import { clickStart, mountSetup, startAndSettle, typeName, ui } from '../../test/setupAccountKit';
import type { AccountUser } from '../../account/accountApi';

// Pixi needs WebGL, which jsdom lacks; tile pictures are drawn by Pixi too
vi.mock('./CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

const startButton = () => screen.getByRole('button', { name: 'Start match' });

describe('CharacterSetup Start while the accounts start up', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.restoreAllMocks(); });

    it('waits for a stored login and starts under its nickname, not the typed name', async () => {
        const session = deferred<AccountUser | null>();
        h.api.currentUser.mockReturnValue(session.promise);
        const { onContinue } = await mountSetup(h);
        typeName('Bo');
        clickStart();
        expect(startButton()).toBeDisabled();
        expect(onContinue).not.toHaveBeenCalled();

        await act(async () => { session.resolve(ALEX); });
        await h.settle();
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(ui().state.playerName).toBe('Alex');
        expect(h.api.isNicknameTaken).not.toHaveBeenCalled();
    });

    it('checks the name once start-up finds no login', async () => {
        const session = deferred<AccountUser | null>();
        h.api.currentUser.mockReturnValue(session.promise);
        h.api.isNicknameTaken.mockResolvedValue(true);
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        clickStart();
        await act(async () => { session.resolve(null); });
        await h.settle();
        expect(h.api.isNicknameTaken).toHaveBeenCalledWith('Alex');
        expect(onContinue).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

describe('CharacterSetup guest name rules and account links', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.restoreAllMocks(); });

    it('refuses a look-alike guest name with a hint, and starts once it is fixed', async () => {
        const { onContinue } = await mountSetup(h);
        typeName('Ａlex'); // fullwidth A
        await startAndSettle(h);
        expect(onContinue).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/Latin or Russian letters.*Change the name to start the match/);
        expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
        typeName('Alex');
        expect(screen.queryByText(/Change the name/)).not.toBeInTheDocument();
        await startAndSettle(h);
        expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('disables the log-in and protect links while the name check runs', async () => {
        const answer = deferred<boolean>();
        h.api.isNicknameTaken.mockReturnValue(answer.promise);
        await mountSetup(h);
        typeName('Alex');
        clickStart();
        expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Protect nickname/ })).toBeDisabled();
        await act(async () => { answer.resolve(false); });
        expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    });

    it('makes the page behind an open account window inert, and gives it back on close', async () => {
        await mountSetup(h);
        const link = screen.getByRole('button', { name: 'Log in' });
        link.focus(); // jsdom does not focus on click
        fireEvent.click(link);
        expect(startButton().closest('[inert]')).not.toBeNull();
        expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(startButton().closest('[inert]')).toBeNull();
        expect(link).toHaveFocus();
    });
});
