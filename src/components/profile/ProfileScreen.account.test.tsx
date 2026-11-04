import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AccountError } from '../../account/accountError';
import { AccountContext } from '../../account/useAccount';
import { UIProvider } from '../../store/uiStore';
import { stubAccount } from '../../test/accountStub';
import { ALEX, deferred, installAccountHarness } from '../../test/accountHarness';
import { mountProfile, unlock } from '../../test/profileKit';
import { ProfileScreen } from './ProfileScreen';

describe('ProfileScreen account area', () => {
    const h = installAccountHarness();

    const mountLoggedIn = () => {
        h.api.currentUser.mockResolvedValue(ALEX);
        return mountProfile(h);
    };
    const logOutButton = () => screen.queryByRole('button', { name: 'Log out' });
    const protectButton = () => screen.queryByRole('button', { name: /Protect your nickname/ });
    const dialog = () => screen.getByRole('dialog');
    const confirmLogout = async () => {
        fireEvent.click(logOutButton() as HTMLElement);
        await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /^(Log out|Please wait…)$/ })); });
        await h.settle();
    };

    it('logged in: the account nickname, the cloud marker and Log out, no call to action', async () => {
        await mountLoggedIn();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alex');
        expect(screen.getByText('Saved in your account')).toBeInTheDocument();
        expect(logOutButton()).toBeInTheDocument();
        expect(protectButton()).not.toBeInTheDocument();
    });

    it('guest: offers to protect the nickname, no Log out, no cloud marker', async () => {
        await mountProfile(h);
        expect(protectButton()).toBeInTheDocument();
        expect(logOutButton()).not.toBeInTheDocument();
        expect(screen.queryByText('Saved in your account')).not.toBeInTheDocument();
    });

    it('guest: the call to action opens the New account window with the current name', async () => {
        const { setGuestName } = await mountProfile(h);
        setGuestName('Zed');
        fireEvent.click(protectButton() as HTMLElement);
        expect(within(dialog()).getByRole('tab', { name: 'New account' })).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog()).getByLabelText('Nickname')).toHaveValue('Zed');
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('guest: the default name "Anonymous" is not put into the window', async () => {
        await mountProfile(h);
        fireEvent.click(protectButton() as HTMLElement);
        expect(within(dialog()).getByLabelText('Nickname')).toHaveValue('');
    });

    it('accounts disabled: the guest profile with no account parts', async () => {
        unlock('veteran');
        await mountProfile(h, null);
        expect(screen.getByText('Title: Veteran')).toBeInTheDocument();
        expect(protectButton()).not.toBeInTheDocument();
        expect(logOutButton()).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });

    it('while accounts are starting up: neither Log out nor the call to action', async () => {
        h.api.currentUser.mockReturnValue(new Promise(() => {}));
        await mountProfile(h);
        expect(protectButton()).not.toBeInTheDocument();
        expect(logOutButton()).not.toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(20);
    });

    it('Log out asks first, and Cancel changes nothing', async () => {
        await mountLoggedIn();
        fireEvent.click(logOutButton() as HTMLElement);
        expect(within(dialog()).getByText('Log out of this account?')).toBeInTheDocument();
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(h.api.logOut).not.toHaveBeenCalled();
        expect(logOutButton()).toBeInTheDocument();
    });

    it('confirming logs out: a guest profile with the local data cleared', async () => {
        unlock('veteran');
        await mountLoggedIn();
        expect(screen.getByText('Title: Veteran')).toBeInTheDocument();
        await confirmLogout();
        expect(h.api.logOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(logOutButton()).not.toBeInTheDocument();
        expect(protectButton()).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anonymous');
        expect(screen.getByText('0/20')).toBeInTheDocument();
        expect(screen.queryByText(/^Title:/)).not.toBeInTheDocument();
    });

    it('disables the button while the logout runs; Cancel and Escape still close the window', async () => {
        const request = deferred<void>();
        h.api.logOut.mockReturnValue(request.promise);
        await mountLoggedIn();
        await confirmLogout();
        const busy = within(dialog()).getByRole('button', { name: 'Please wait…' });
        expect(busy).toBeDisabled();
        const cancel = within(dialog()).getByRole('button', { name: 'Cancel' });
        expect(cancel).toBeEnabled();
        fireEvent.click(cancel);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await act(async () => { request.resolve(); });
        await h.settle();
        expect(h.api.logOut).toHaveBeenCalledTimes(1); // the provider finished the logout on its own
        expect(protectButton()).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape closes the window while the logout runs', async () => {
        const request = deferred<void>();
        h.api.logOut.mockReturnValue(request.promise);
        await mountLoggedIn();
        await confirmLogout();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await act(async () => { request.resolve(); });
        await h.settle();
        expect(protectButton()).toBeInTheDocument();
    });

    describe('when logging out fails', () => {
        const mountWith = (logOut: () => Promise<void>) => render(
            <UIProvider>
                <AccountContext.Provider value={stubAccount({ status: 'loggedIn', nickname: 'Alex', logOut })}>
                    <ProfileScreen onBack={vi.fn()} />
                </AccountContext.Provider>
            </UIProvider>,
        );

        it('shows the message of an account error and lets the player try again', async () => {
            const logOut = vi.fn().mockRejectedValue(new AccountError('network', 'offline'));
            mountWith(logOut);
            await confirmLogout();
            expect(within(dialog()).getByRole('alert')).toHaveTextContent('No connection to accounts right now. Try again in a moment.');
            expect(within(dialog()).getByRole('button', { name: 'Log out' })).toBeEnabled();
        });

        it('logs anything else and shows a generic message', async () => {
            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            mountWith(vi.fn().mockRejectedValue(new Error('boom')));
            await confirmLogout();
            expect(error).toHaveBeenCalled();
            expect(within(dialog()).getByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
            error.mockRestore();
        });
    });
});
