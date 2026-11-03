import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AccountError, AccountErrorCode } from '../../../account/accountError';
import { AccountContext, AccountState } from '../../../account/useAccount';
import { AccountModal } from './AccountModal';

type Fake = AccountState & { signUp: Mock; logIn: Mock };
const fakeAccount = (): Fake => ({
    status: 'guest', nickname: null,
    signUp: vi.fn().mockResolvedValue(undefined), logIn: vi.fn().mockResolvedValue(undefined),
    logOut: vi.fn(), isNicknameTaken: vi.fn(),
}) as Fake;

let account: Fake;
const onClose = vi.fn();
const open = (initialTab: 'signup' | 'login' = 'signup', initialNickname = 'Alex') => render(
    <AccountContext.Provider value={account}>
        <AccountModal initialTab={initialTab} initialNickname={initialNickname} onClose={onClose} />
    </AccountContext.Provider>,
);
const nick = () => screen.getByLabelText('Nickname');
const password = () => screen.getByLabelText('Password');
const submit = (name: 'Create' | 'Log in') => within(screen.getByRole('dialog')).getByRole('button', { name });
const fill = (nickname: string, pw: string) => {
    fireEvent.change(nick(), { target: { value: nickname } });
    fireEvent.change(password(), { target: { value: pw } });
};

beforeEach(() => {
    account = fakeAccount();
    onClose.mockClear();
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null); // the game language: English
});
afterEach(() => { vi.restoreAllMocks(); });

describe('AccountModal', () => {
    it('opens on the requested tab with the nickname filled in', () => {
        open('login', 'Alex');
        expect(screen.getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'New account' })).toHaveAttribute('aria-selected', 'false');
        expect(nick()).toHaveValue('Alex');
        expect(submit('Log in')).toBeEnabled();
    });

    it('speaks Russian when the game language is Russian', () => {
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key === 'gameLanguage' ? 'ru' : null));
        open('signup');
        expect(screen.getByRole('tab', { name: 'Новый аккаунт' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Создать' })).toBeInTheDocument();
        expect(screen.getByText(/Пароль не восстановить/)).toBeInTheDocument();
    });

    it('warns that the password cannot be recovered only on the New account tab', () => {
        open('signup');
        expect(screen.getByText(/password cannot be recovered/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Log in' }));
        expect(screen.queryByText(/password cannot be recovered/i)).not.toBeInTheDocument();
        expect(submit('Log in')).toBeInTheDocument();
    });

    it('switching tabs keeps what was typed and clears an old error', () => {
        open('signup', '');
        fill('ab', 'secret1');
        fireEvent.click(submit('Create'));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Log in' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(nick()).toHaveValue('ab');
        expect(password()).toHaveValue('secret1');
    });

    it('focuses the first empty field', () => {
        const { unmount } = open('signup', '');
        expect(nick()).toHaveFocus();
        unmount();
        open('signup', 'Alex');
        expect(password()).toHaveFocus();
    });

    it('creates the account and closes', async () => {
        open('signup');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Create'));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(account.signUp).toHaveBeenCalledWith('Alex', 'secret1');
        expect(account.logIn).not.toHaveBeenCalled();
    });

    it('logs in and closes', async () => {
        open('login');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Log in'));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(account.logIn).toHaveBeenCalledWith('Alex', 'secret1');
    });

    it.each([
        ['ab', /at least 3 characters/],
        ['a'.repeat(13), /at most 12 characters/],
        ['Al!ex', /letters, digits/],
        ['Alех', /Latin and Cyrillic/], // the last two letters are Cyrillic
        ['Anonymous', /reserved/],
    ])('shows the rule a bad nickname breaks (%s) without calling the api', (value, message) => {
        open('signup', '');
        fill(value, 'secret1');
        fireEvent.click(submit('Create'));
        expect(screen.getByRole('alert')).toHaveTextContent(message);
        expect(account.signUp).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('shows the password rule without calling the api', () => {
        open('login');
        fill('Alex', '12345');
        fireEvent.click(submit('Log in'));
        expect(screen.getByRole('alert')).toHaveTextContent(/Password needs at least 6 characters/);
        expect(account.logIn).not.toHaveBeenCalled();
    });

    it.each<[AccountErrorCode, RegExp]>([
        ['taken', /nickname is taken/i],
        ['bad_credentials', /wrong nickname or password/i],
        ['invalid_nickname', /not allowed/i],
        ['weak_password', /at least 6 characters/i],
        ['rate_limited', /too many attempts/i],
        ['network', /no connection/i],
    ])('shows an inline message for the %s error and stays open', async (code, message) => {
        account.signUp.mockRejectedValue(new AccountError(code));
        open('signup');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Create'));
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(onClose).not.toHaveBeenCalled();
        expect(submit('Create')).toBeEnabled();
    });

    it('reports an unexpected error instead of swallowing it', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        account.logIn.mockRejectedValue(new Error('log in while another login is running'));
        open('login');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Log in'));
        expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
        expect(error).toHaveBeenCalled();
    });

    it('disables submit while the call runs, so it is sent once', async () => {
        let finish!: () => void;
        account.signUp.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
        open('signup');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Create'));
        const busy = within(screen.getByRole('dialog')).getByRole('button', { name: 'Please wait…' });
        expect(busy).toBeDisabled();
        fireEvent.submit(password());
        expect(account.signUp).toHaveBeenCalledTimes(1);
        finish();
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('closes on Escape and on Cancel', () => {
        open('signup');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('does not report back after it was closed while a call was running', async () => {
        let finish!: () => void;
        account.signUp.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
        const { unmount } = open('signup');
        fill('Alex', 'secret1');
        fireEvent.click(submit('Create'));
        unmount();
        finish();
        await Promise.resolve();
        expect(onClose).not.toHaveBeenCalled();
    });
});
