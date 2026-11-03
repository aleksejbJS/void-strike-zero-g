// What happens between "Start" and the match on the setup screen, as far as accounts are concerned:
// which name the match uses, the taken-name check for a guest, and the sign-up / log-in window.

import { useCallback, useEffect, useRef, useState } from 'react';
import { GUEST_DEFAULT_NAME, nicknameKey } from '../../../account/nickname';
import { useAccount } from '../../../account/useAccount';
import { useTranslation } from '../../../i18n/useTranslation';
import type { AccountTab } from './useAccountForm';
import { needsTakenCheck, useTakenCheck } from './useTakenCheck';

/** What to open the account window with; `notice` says why it opened by itself. */
export interface ModalRequest { tab: AccountTab; nickname: string; notice?: string }

/** "Anonymous" is the guest default, not a nickname worth putting into an account form. */
export const nicknameFor = (name: string): string =>
    (nicknameKey(name) === GUEST_DEFAULT_NAME.toLowerCase() ? '' : name.trim());

/**
 * `name` is the guest's name field; `launch` starts the match with the name it is given.
 * Logged in, that name is the account nickname, whatever the field says.
 */
export function useStartGate(name: string, launch: (playerName: string) => void) {
    const account = useAccount();
    const isTaken = useTakenCheck();
    const { t } = useTranslation();
    const [modal, setModal] = useState<ModalRequest | null>(null);
    const [checking, setChecking] = useState(false);
    const [takenName, setTakenName] = useState<string | null>(null);
    const checkingNow = useRef(false); // set at once: a second click can come before the re-render
    const mounted = useRef(true);
    const latestLaunch = useRef(launch); // the screen may change while the check runs

    useEffect(() => { latestLaunch.current = launch; });
    useEffect(() => {
        mounted.current = true; // StrictMode runs the cleanup once before the real mount
        return () => { mounted.current = false; };
    }, []);

    const openModal = useCallback((tab: AccountTab) => setModal({ tab, nickname: nicknameFor(name) }), [name]);
    const closeModal = useCallback(() => setModal(null), []);

    const playerName = account.status === 'loggedIn' && account.nickname ? account.nickname : name.trim() || GUEST_DEFAULT_NAME;

    const check = async (): Promise<void> => {
        checkingNow.current = true;
        setChecking(true);
        setTakenName(null);
        const guestName = name.trim();
        const taken = await isTaken(guestName); // never rejects
        checkingNow.current = false;
        if (!mounted.current) return; // the player left the screen meanwhile
        setChecking(false);
        if (!taken) { latestLaunch.current(playerName); return; }
        setTakenName(guestName);
        setModal({ tab: 'login', nickname: guestName, notice: t('ac.taken') });
    };

    const requestStart = (): void => {
        if (checkingNow.current) return;
        if (needsTakenCheck(account.status, name)) void check();
        else launch(playerName);
    };

    return { modal, openModal, closeModal, checking, takenName, requestStart };
}
