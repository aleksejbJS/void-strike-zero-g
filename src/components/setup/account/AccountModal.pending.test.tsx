import React from 'react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    it('sends the call once, and keeps Cancel and Escape from closing the window', async () => {
        open();
        fillAndCreate();
        expect(dialog().getByRole('button', { name: 'Please wait…' })).toBeDisabled();
        fireEvent.submit(screen.getByLabelText('Password'));
        expect(signUp).toHaveBeenCalledTimes(1);

        expect(dialog().getByRole('button', { name: 'Cancel' })).toBeDisabled();
        fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();

        finish();
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1)); // closed by the success
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
