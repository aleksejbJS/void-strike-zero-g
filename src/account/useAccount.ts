// What the UI sees of the account: its status and the login / logout actions.
// Provided by AccountProvider. The methods reject with AccountError, which the UI turns into messages
// ('network' also means "not available right now": disabled, starting up, or a logout still finishing).
// An action the current status does not allow at all (log in while logged in, log out as a guest, a second
// call while one runs) is a programming mistake and rejects with a plain Error.

import { createContext, useContext } from 'react';

export type AccountStatus = 'disabled' | 'loading' | 'guest' | 'loggedIn';

export interface AccountState {
    status: AccountStatus;
    /** The account nickname while logged in, otherwise null. */
    nickname: string | null;
    signUp(nick: string, pw: string): Promise<void>;
    logIn(nick: string, pw: string): Promise<void>;
    logOut(): Promise<void>;
    isNicknameTaken(nick: string): Promise<boolean>;
}

export const AccountContext = createContext<AccountState | null>(null);

export function useAccount(): AccountState {
    const account = useContext(AccountContext);
    if (!account) throw new Error('useAccount must be used within AccountProvider');
    return account;
}
