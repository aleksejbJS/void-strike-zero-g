import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { installAccountHarness, networkError } from '../../test/accountHarness';
import { clickStart, mountSetup, startAndSettle, typeName, ui } from '../../test/setupAccountKit';
import { onProgressChanged } from '../../account/progressEvents';

// Pixi needs WebGL, which jsdom lacks; tile pictures are drawn by Pixi too
vi.mock('./CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

describe('CharacterSetup Start for a guest', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.restoreAllMocks(); });

    const dialog = () => screen.getByRole('dialog');
    const holdAnswer = () => {
        let answer!: (taken: boolean) => void;
        h.api.isNicknameTaken.mockReturnValue(new Promise<boolean>(resolve => { answer = resolve; }));
        return (taken: boolean) => act(async () => { answer(taken); });
    };

    it('blocks Start for a taken name and opens Log in with the name filled', async () => {
        h.api.isNicknameTaken.mockResolvedValue(true);
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        await startAndSettle(h);
        expect(h.api.isNicknameTaken).toHaveBeenCalledWith('Alex');
        expect(onContinue).not.toHaveBeenCalled();
        expect(ui().state.isPlaying).toBe(false);
        expect(within(dialog()).getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog()).getByLabelText('Nickname')).toHaveValue('Alex');
        expect(screen.getByText("This name is taken. If it's your account, enter the password")).toBeInTheDocument();
    });

    it('drops the message once the name is edited', async () => {
        h.api.isNicknameTaken.mockResolvedValue(true);
        await mountSetup(h);
        typeName('Alex');
        await startAndSettle(h);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.getByText(/This name is taken/)).toBeInTheDocument();
        typeName('Alexa');
        expect(screen.queryByText(/This name is taken/)).not.toBeInTheDocument();
    });

    it('starts when the name is free', async () => {
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        await startAndSettle(h);
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(ui().state.playerName).toBe('Alex');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not ask about the default name', async () => {
        const { onContinue } = await mountSetup(h);
        await startAndSettle(h);
        expect(h.api.isNicknameTaken).not.toHaveBeenCalled();
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(ui().state.playerName).toBe('Anonymous');
    });

    it('disables Start and the name while the check runs, so one click starts one match', async () => {
        const answer = holdAnswer();
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        clickStart();
        expect(screen.getByRole('button', { name: 'Start match' })).toBeDisabled();
        expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
        clickStart();
        await answer(false);
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(h.api.isNicknameTaken).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Start match' })).toBeEnabled();
    });

    it('lets the guest in after 3000 ms without an answer', async () => {
        h.api.isNicknameTaken.mockReturnValue(new Promise(() => {}));
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        await startAndSettle(h);
        expect(onContinue).not.toHaveBeenCalled();
        await h.advance(2999);
        expect(onContinue).not.toHaveBeenCalled();
        await h.advance(1);
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(h.warn).toHaveBeenCalled();
    });

    it('lets the guest in when the service cannot be reached', async () => {
        h.api.isNicknameTaken.mockRejectedValue(networkError());
        const { onContinue } = await mountSetup(h);
        typeName('Alex');
        await startAndSettle(h);
        expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('does not start a match after the screen was left during the check', async () => {
        const answer = holdAnswer();
        const { onContinue, view } = await mountSetup(h);
        typeName('Alex');
        clickStart();
        view.unmount();
        await answer(false);
        expect(onContinue).not.toHaveBeenCalled();
        expect(ui().state.isPlaying).toBe(false);
    });

    it('tells the account a changed look was saved, and stays quiet otherwise', async () => {
        const changed = vi.fn();
        const stop = onProgressChanged(changed);
        await mountSetup(h, null);
        clickStart(); // the default look: nothing to stamp
        expect(changed).not.toHaveBeenCalled();
        fireEvent.click(within(screen.getByRole('group', { name: 'Helmet' })).getByRole('button', { name: 'Robot' }));
        clickStart();
        expect(changed).toHaveBeenCalledTimes(1);
        stop();
    });
});
