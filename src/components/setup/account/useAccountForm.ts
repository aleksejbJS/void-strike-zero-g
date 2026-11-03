// State of the sign-up / log-in window: checks the fields before asking the service, runs one call at a time
// and turns every failure into an inline message.

import { useEffect, useRef, useState } from 'react';
import { AccountError } from '../../../account/accountError';
import { validateNickname } from '../../../account/nickname';
import { useAccount } from '../../../account/useAccount';
import { useTranslation } from '../../../i18n/useTranslation';
import { accountErrorMessage, isPasswordTooShort, nicknameMessage, passwordMessage } from './accountMessages';

export type AccountTab = 'signup' | 'login';

export function useAccountForm(onDone: () => void) {
    const account = useAccount();
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const running = useRef(false); // set at once: a second submit can come before the re-render
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true; // StrictMode runs the cleanup once before the real mount
        return () => { mounted.current = false; };
    }, []);

    const submit = async (tab: AccountTab, nickname: string, password: string): Promise<void> => {
        if (running.current) return;
        const nickProblem = validateNickname(nickname);
        if (nickProblem) { setError(nicknameMessage(t, nickProblem)); return; }
        if (isPasswordTooShort(password)) { setError(passwordMessage(t)); return; }

        running.current = true;
        setPending(true);
        setError(null);
        try {
            await (tab === 'signup' ? account.signUp : account.logIn)(nickname, password);
            if (mounted.current) onDone();
        } catch (failure) {
            // An AccountError is an expected outcome; anything else is a misuse of the account API.
            if (!(failure instanceof AccountError)) console.error('[account] unexpected error in the account window:', failure);
            if (mounted.current) setError(accountErrorMessage(t, failure));
        } finally {
            running.current = false;
            if (mounted.current) setPending(false);
        }
    };

    return { error, pending, submit, clearError: () => setError(null) };
}
