// "Is this guest name somebody's account?" for the Start button. Only a guest with a real name is checked;
// a slow or broken service never blocks a match: the check then answers "not taken" and warns.

import { useCallback, useEffect, useRef } from 'react';
import { GUEST_DEFAULT_NAME, nicknameKey } from '../../../account/nickname';
import { AccountStatus, useAccount } from '../../../account/useAccount';

export const TAKEN_CHECK_TIMEOUT_MS = 3000;

const TIMED_OUT = Symbol('timed out');

/** Whether Start has anything to ask about: a guest whose name is not empty nor the default one. */
export const needsTakenCheck = (status: AccountStatus, name: string): boolean => {
    const key = nicknameKey(name);
    return status === 'guest' && key !== '' && key !== GUEST_DEFAULT_NAME.toLowerCase();
};

/** Resolves true only when the service says the name belongs to an account. Never rejects. */
export function useTakenCheck(): (name: string) => Promise<boolean> {
    const { status, isNicknameTaken } = useAccount();
    // The status when the check runs, not when Start was clicked (Start may wait for the start-up first).
    const latest = useRef({ status, isNicknameTaken });
    useEffect(() => { latest.current = { status, isNicknameTaken }; });

    return useCallback(async (name: string): Promise<boolean> => {
        const { status, isNicknameTaken } = latest.current;
        if (!needsTakenCheck(status, name)) return false;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<typeof TIMED_OUT>(resolve => {
            timer = setTimeout(() => resolve(TIMED_OUT), TAKEN_CHECK_TIMEOUT_MS);
        });
        try {
            const answer = await Promise.race([isNicknameTaken(name.trim()), timeout]);
            if (answer === TIMED_OUT) {
                console.warn(`[account] the taken-name check did not answer in ${TAKEN_CHECK_TIMEOUT_MS} ms, letting the player in`);
                return false;
            }
            return answer;
        } catch (error) {
            console.warn('[account] the taken-name check failed, letting the player in:', error);
            return false;
        } finally {
            clearTimeout(timer);
        }
    }, []);
}
