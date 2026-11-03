import React from 'react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { AccountError } from '../../../account/accountError';
import { AccountContext, AccountState } from '../../../account/useAccount';
import { AccountModal } from './AccountModal';

let signUp: Mock;
let finish: () => void;
const onClose = vi.fn();

const open = (notice?: string) => render(
    <AccountContext.Provider value={{ status: 'guest', nickname: null, signUp, logIn: vi.fn() } as unknown as AccountState}>
        <AccountModal initialTab="signup" initialNickname="Alex" onClose={onClose} notice={notice} />
    </AccountContext.Provider>,
);
const dialog = () => within(screen.getByRole('dialog'));
const fillAndCreate = () => {
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Create' }));
};

beforeEach(() => {
    onClose.mockClear();
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    signUp = vi.fn().mockReturnValue(new Promise<void>(resolve => { finish = resolve; })); // held until the test lets go
});

describe('AccountModal notice', () => {
    it('shows why it opened, above the tabs', () => {
        open('This name is taken.');
        const notice = dialog().getByRole('status');
        expect(notice).toHaveTextContent('This name is taken.');
        expect(notice.compareDocumentPosition(dialog().getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('has no status line without a notice', () => {
        open();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('AccountModal while a call runs', () => {
    it('sends the call once; Cancel closes the window while it runs and the late result is ignored', async () => {
        const error = vi.spyOn(console, 'error');
        open();
        fillAndCreate();
        expect(dialog().getByRole('button', { name: 'Please wait…' })).toBeDisabled();
        fireEvent.submit(screen.getByLabelText('Password'));
        expect(signUp).toHaveBeenCalledTimes(1);

        expect(dialog().getByRole('button', { name: 'Cancel' })).toBeEnabled();
        fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);

        finish();
        await act(async () => { await Promise.resolve(); });
        expect(onClose).toHaveBeenCalledTimes(1); // the success does not close it a second time
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('Escape closes the window while a call runs, and a late failure shows nothing', async () => {
        let fail!: (reason: unknown) => void;
        signUp.mockReset().mockReturnValue(new Promise<void>((_resolve, reject) => { fail = reject; }));
        open();
        fillAndCreate();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        await act(async () => { fail(new AccountError('network')); await Promise.resolve(); });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('closes on Escape and Cancel again after a failed call', async () => {
        signUp.mockReset().mockRejectedValue(new AccountError('network'));
        open();
        fillAndCreate();
        await screen.findByRole('alert');
        expect(dialog().getByRole('button', { name: 'Cancel' })).toBeEnabled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not report back when the screen was left meanwhile', async () => {
        const { unmount } = open();
        fillAndCreate();
        unmount();
        finish();
        await Promise.resolve();
        expect(onClose).not.toHaveBeenCalled();
    });
});
