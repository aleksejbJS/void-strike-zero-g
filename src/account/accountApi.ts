// Nickname + password accounts on Supabase: the only module that talks to the backend.
// Every method either resolves or rejects with an AccountError the UI can turn into a message.

import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, guarded } from './accountError';
import { PASSWORD_MIN } from './passwordRules';
import { endLocalSession, readSessionUser, watchSessionEnd } from './accountSession';
import { nicknameKey, nicknameToEmail, normalizeNickname, validateExistingNickname, validateNickname } from './nickname';
import { isUsableNickname, readCachedNickname } from './nicknameCache';
import { PlayerSnapshot, sanitizeSnapshot } from './snapshot';
import type { StoredAuthUser } from './storedAuth';

export { AccountError } from './accountError';
export type { AccountErrorCode } from './accountError';

export { PASSWORD_MIN };

export interface AccountUser { id: string; nickname: string }

export interface AccountApi {
    signUp(nick: string, password: string): Promise<AccountUser>;
    logIn(nick: string, password: string): Promise<AccountUser>;
    logOut(): Promise<void>;
    /**
     * Null when no session is stored on this device. A stored session whose nickname cannot be read (the
     * cloud is unreachable) still resolves, with the nickname last seen here or the one in the session
     * metadata; rejects only when no nickname is known, or the session cannot be read at all.
     */
    currentUser(): Promise<AccountUser | null>;
    /** False without a request for a name that fails validation. Rejects when the lookup fails. */
    isNicknameTaken(nick: string): Promise<boolean>;
    /** Null when the account has no saved progress yet. */
    fetchSnapshot(userId: string): Promise<PlayerSnapshot | null>;
    saveSnapshot(userId: string, snapshot: PlayerSnapshot): Promise<void>;
    /**
     * Calls `listener` (outside the auth lock, a moment later) whenever the session on this device ends:
     * our own logOut, a session the server no longer accepts, a logout in another tab. Returns the unsubscribe.
     */
    onSessionEnded(listener: () => void): () => void;
}

const NO_SESSION_HINT =
    '[account] sign-up returned no session. "Confirm email" is still on in Supabase: ' +
    'turn it off under Authentication -> Sign In / Providers -> Email (see docs/supabase-setup.md).';

export function createAccountApi(client: SupabaseClient): AccountApi {
    /** The display nickname lives in `profiles` (written by the sign-up trigger), not in the e-mail. */
    async function readNickname(userId: string): Promise<string> {
        const { data, error } = await client.from('profiles').select('nickname').eq('id', userId).maybeSingle();
        if (error) throw error;
        if (!data || typeof data.nickname !== 'string') {
            console.error(`[account] no profile row for user ${userId}: the sign-up trigger from the migration is missing`);
            throw new AccountError('network', 'profile row missing');
        }
        return data.nickname;
    }

    /**
     * The nickname of a user who just signed in. Falls back to the one written at sign-up (session metadata)
     * when `profiles` cannot be read. With neither, the fresh session is ended again before rejecting, so a
     * reload cannot silently log the player in after the window said the login failed.
     */
    async function nicknameAfterLogin(user: StoredAuthUser): Promise<string> {
        try {
            return await readNickname(user.id);
        } catch (error) {
            const known = user.user_metadata?.nickname;
            if (isUsableNickname(known)) {
                console.warn(`[account] could not read the nickname of user ${user.id}, using "${known}" from the session:`, error);
                return known;
            }
            try {
                await endLocalSession(client, 'login clean-up');
            } catch (endError) {
                console.warn('[account] the nameless login could not be ended cleanly (its stored session was removed):', endError);
            }
            throw error;
        }
    }

    return {
        async signUp(nick, password) {
            const problem = validateNickname(nick);
            if (problem) throw new AccountError('invalid_nickname', problem);
            if (password.length < PASSWORD_MIN) throw new AccountError('weak_password', `shorter than ${PASSWORD_MIN} characters`);
            const nickname = normalizeNickname(nick);

            return guarded('signUp', async () => {
                const { data, error } = await client.auth.signUp({
                    email: nicknameToEmail(nickname),
                    password,
                    // Read by the database trigger that creates the profile row.
                    options: { data: { nickname, nickname_key: nicknameKey(nickname) } },
                });
                if (error) throw error;
                if (!data.session || !data.user) {
                    console.error(NO_SESSION_HINT);
                    throw new AccountError('network', 'sign-up returned no session');
                }
                return { id: data.user.id, nickname };
            });
        },

        async logIn(nick, password) {
            // No account can carry a name that fails the rules, so there is nothing to ask the server. The wider
            // rules: accounts registered before the whitelist must still be able to log in.
            if (validateExistingNickname(nick) !== null) throw new AccountError('bad_credentials', 'invalid nickname');

            return guarded('logIn', async () => {
                const { data, error } = await client.auth.signInWithPassword({ email: nicknameToEmail(nick), password });
                if (error) throw error;
                return { id: data.user.id, nickname: await nicknameAfterLogin(data.user) };
            });
        },

        async logOut() {
            await endLocalSession(client, 'logout');
        },

        async currentUser() {
            const user = await readSessionUser(client);
            if (!user) return null;
            try {
                return { id: user.id, nickname: await guarded('currentUser', () => readNickname(user.id)) };
            } catch (error) {
                const known = readCachedNickname(user.id) ?? user.user_metadata?.nickname;
                if (!isUsableNickname(known)) throw error;
                console.warn(`[account] could not read the nickname of user ${user.id}, using "${known}" from this device:`, error);
                return { id: user.id, nickname: known };
            }
        },

        async isNicknameTaken(nick) {
            if (validateExistingNickname(nick) !== null) return false;
            return guarded('isNicknameTaken', async () => {
                const { data, error } = await client.rpc('nickname_taken', { nick_key: nicknameKey(nick) });
                if (error) throw error;
                return data === true;
            });
        },

        async fetchSnapshot(userId) {
            return guarded('fetchSnapshot', async () => {
                const { data, error } = await client.from('player_progress').select('data').eq('user_id', userId).maybeSingle();
                if (error) throw error;
                return data ? sanitizeSnapshot(data.data) : null;
            });
        },

        async saveSnapshot(userId, snapshot) {
            return guarded('saveSnapshot', async () => {
                const { error } = await client
                    .from('player_progress')
                    .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() });
                if (error) throw error;
            });
        },

        onSessionEnded(listener) {
            return watchSessionEnd(client, listener);
        },
    };
}
