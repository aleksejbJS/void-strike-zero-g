// The account windows as layers over the page (inert background, focus back), the "previous request
// still finishing" message, and which nickname rules each tab applies.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AccountError } from '../../../account/accountError';
import { AccountContext, AccountState } from '../../../account/useAccount';
import { stubAccount } from '../../../test/accountStub';
import { LogoutConfirm } from '../../profile/LogoutConfirm';
import { inertOutside } from '../../useModalLayer';
import { AccountModal } from './AccountModal';
import { modalKey } from './useStartGate';

let account: AccountState & { signUp: Mock; logIn: Mock };
const onClose = vi.fn();

const page = (window: React.ReactNode) => render(
    <AccountContext.Provider value={account}>
        <main><button type="button">Start match</button></main>
        <div id="overlay-host">{window}</div>
    </AccountContext.Provider>,
);
const dialog = () => within(screen.getByRole('dialog'));
const fill = (nickname: string) => {
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: nickname } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
};

beforeEach(() => {
    account = stubAccount() as typeof account;
    onClose.mockClear();
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null); // the game language: English
});
afterEach(() => { vi.restoreAllMocks(); });

describe('account windows over the page', () => {
    it.each([
        ['AccountModal', () => <AccountModal initialTab="login" initialNickname="" onClose={onClose} />],
        ['LogoutConfirm', () => <LogoutConfirm onClose={onClose} />],
    ])('%s makes the rest of the page inert while open', (_name, make) => {
        const { unmount } = page(make());
        expect(screen.getByRole('button', { name: 'Start match' }).closest('[inert]')).not.toBeNull();
        expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
        unmount();
        expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    });

    it('leaves elements that were inert before alone', () => {
        const root = document.createElement('div');
        root.innerHTML = '<section inert></section><nav></nav><div><p id="layer"></p><span></span></div>';
        document.body.appendChild(root);
        const undo = inertOutside(root.querySelector('#layer') as HTMLElement);
        expect(root.querySelector('nav')).toHaveAttribute('inert');
        expect(root.querySelector('span')).toHaveAttribute('inert');
        undo();
        expect(root.querySelector('nav')).not.toHaveAttribute('inert');
        expect(root.querySelector('section')).toHaveAttribute('inert');
        root.remove();
    });

    it('a new request is a new window (the caller keys it on the request)', () => {
        expect(modalKey({ tab: 'login', nickname: 'Alex' })).not.toBe(modalKey({ tab: 'signup', nickname: 'Alex' }));
        expect(modalKey({ tab: 'login', nickname: 'Alex' })).not.toBe(modalKey({ tab: 'login', nickname: 'Bo' }));
    });
});

describe('account window messages', () => {
    it('says the previous request is still finishing instead of "no connection"', async () => {
        account.logIn.mockRejectedValue(new AccountError('busy'));
        page(<AccountModal initialTab="login" initialNickname="Alex" onClose={onClose} />);
        fill('Alex');
        fireEvent.click(dialog().getByRole('button', { name: 'Log in' }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Previous request is still finishing, try again in a moment.');
        expect(alert).not.toHaveTextContent(/no connection/i);
    });

    it('lets an older account log in with a name today\'s rules would refuse', async () => {
        page(<AccountModal initialTab="login" initialNickname="" onClose={onClose} />);
        fill('Élan');
        fireEvent.click(dialog().getByRole('button', { name: 'Log in' }));
        expect(account.logIn).toHaveBeenCalledWith('Élan', 'secret1');
    });

    it('does not create a new account with such a name', () => {
        page(<AccountModal initialTab="signup" initialNickname="" onClose={onClose} />);
        fill('Élan');
        fireEvent.click(dialog().getByRole('button', { name: 'Create' }));
        expect(screen.getByRole('alert')).toHaveTextContent(/Latin or Russian letters/);
        expect(account.signUp).not.toHaveBeenCalled();
    });
});
