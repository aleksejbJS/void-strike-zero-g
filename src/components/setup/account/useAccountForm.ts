// State of the sign-up / log-in window: checks the fields before asking the service, runs one call at a time
// and turns every failure into an inline message. The window can be closed while a call runs: the account
// provider finishes that call on its own, and its late result is ignored here.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountError } from '../../../account/accountError';
import { validateExistingNickname, validateNickname } from '../../../account/nickname';
import { useAccount } from '../../../account/useAccount';
import { useTranslation } from '../../../i18n/useTranslation';
import { accountErrorMessage, isPasswordTooShort, nicknameMessage, passwordMessage } from './accountMessages';

export type AccountTab = 'signup' | 'login';

/** `onClose` closes the window: after a successful call, or when the player dismisses it. */
export function useAccountForm(onClose: () => void) {
    const account = useAccount();
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const running = useRef(false); // set at once: a second submit can come before the re-render
    const mounted = useRef(true);
    const dismissed = useRef(false); // closed by the player: whatever the running call returns is ignored

    useEffect(() => {
        mounted.current = true; // StrictMode runs the cleanup once before the real mount
        return () => { mounted.current = false; };
    }, []);

    /** Still on screen and not dismissed: the outcome of a call may be shown. */
    const showing = (): boolean => mounted.current && !dismissed.current;

    const submit = async (tab: AccountTab, nickname: string, password: string): Promise<void> => {
        if (running.current) return;
        // A new account must follow today's rules; an existing one may carry a name from the wider old rules.
        const nickProblem = (tab === 'signup' ? validateNickname : validateExistingNickname)(nickname);
        if (nickProblem) { setError(nicknameMessage(t, nickProblem)); return; }
        if (isPasswordTooShort(password)) { setError(passwordMessage(t)); return; }

        running.current = true;
        setPending(true);
        setError(null);
        try {
            await (tab === 'signup' ? account.signUp : account.logIn)(nickname, password);
            if (showing()) onClose();
        } catch (failure) {
            // An AccountError is an expected outcome; anything else is a misuse of the account API.
            if (!(failure instanceof AccountError)) console.error('[account] unexpected error in the account window:', failure);
            if (showing()) setError(accountErrorMessage(t, failure));
        } finally {
            running.current = false;
            if (showing()) setPending(false);
        }
    };

    /** Cancel / Esc: closes at once, even while a call runs. */
    const dismiss = useCallback((): void => {
        dismissed.current = true;
        onClose();
    }, [onClose]);

    return { error, pending, submit, dismiss, clearError: () => setError(null) };
}
