// What happens between "Start" and the match on the setup screen, as far as accounts are concerned:
// which name the match uses, the guest name rules, the taken-name check and the sign-up / log-in window.

import { useCallback, useEffect, useRef, useState } from 'react';
import { GUEST_DEFAULT_NAME, guestNameProblem, nicknameKey, NicknameError } from '../../../account/nickname';
import { AccountStatus, useAccount } from '../../../account/useAccount';
import { useTranslation } from '../../../i18n/useTranslation';
import type { AccountTab } from './useAccountForm';
import { useSettledStatus } from './useSettledStatus';
import { needsTakenCheck, TAKEN_CHECK_TIMEOUT_MS, useTakenCheck } from './useTakenCheck';

/** What to open the account window with; `notice` says why it opened by itself. */
export interface ModalRequest { tab: AccountTab; nickname: string; notice?: string }

/** A Start that was waiting for the accounts when a restored login re-created the screen: the new one resumes it. */
export interface StartCarry { pending: boolean }

/** "Anonymous" is the guest default, not a nickname worth putting into an account form. */
export const nicknameFor = (name: string): string =>
    (nicknameKey(name) === GUEST_DEFAULT_NAME.toLowerCase() ? '' : name.trim());

/** Identity of a window request: a changed request opens a fresh window instead of reusing the old state. */
export const modalKey = (request: ModalRequest): string => `${request.tab}:${request.nickname}:${request.notice ?? ''}`;

/**
 * `name` is the guest's name field; `launch` starts the match with the name it is given.
 * Logged in, that name is the account nickname, whatever the field says.
 */
export function useStartGate(name: string, launch: (playerName: string) => void, carry?: StartCarry) {
    const account = useAccount();
    const isTaken = useTakenCheck();
    const settled = useSettledStatus(account.status);
    const { t } = useTranslation();
    const [modal, setModal] = useState<ModalRequest | null>(null);
    const [checking, setChecking] = useState(false);
    const [takenName, setTakenName] = useState<string | null>(null);
    const [nameRefused, setNameRefused] = useState(false);
    const busyNow = useRef(false); // set at once: a second click can come before the re-render
    const modalOpen = useRef(false); // likewise: a window opened while the check ran must stop the launch
    const mounted = useRef(true);
    const latest = useRef({ account, name, launch }); // the screen may change while Start waits

    useEffect(() => { latest.current = { account, name, launch }; });
    useEffect(() => {
        mounted.current = true; // StrictMode runs the cleanup once before the real mount
        return () => { mounted.current = false; };
    }, []);

    const showModal = useCallback((request: ModalRequest | null) => {
        modalOpen.current = request !== null;
        setModal(request);
    }, []);
    const openModal = useCallback((tab: AccountTab) => showModal({ tab, nickname: nicknameFor(name) }), [name, showModal]);
    const closeModal = useCallback(() => showModal(null), [showModal]);

    const setBusy = (on: boolean): void => {
        busyNow.current = on;
        if (mounted.current) setChecking(on);
    };
    /** The player is busy with an account window: never pull them into a match from under it. */
    const launchNow = (playerName: string): void => {
        if (!modalOpen.current) latest.current.launch(playerName);
    };

    const check = async (guestName: string): Promise<void> => {
        setBusy(true);
        setTakenName(null);
        const taken = await isTaken(guestName); // never rejects
        if (!mounted.current) { busyNow.current = false; return; } // the player left the screen meanwhile
        setBusy(false);
        if (!taken) { launchNow(guestName); return; }
        setTakenName(guestName);
        if (!modalOpen.current) showModal({ tab: 'login', nickname: guestName, notice: t('ac.taken') });
    };

    const startAs = async (status: AccountStatus): Promise<void> => {
        const { account: now, name: field } = latest.current;
        if (status === 'loggedIn' && now.nickname) { launchNow(now.nickname); return; }
        if (guestNameProblem(field)) { setNameRefused(true); return; }
        const guestName = field.trim();
        if (needsTakenCheck(status, guestName)) await check(guestName);
        else launchNow(guestName || GUEST_DEFAULT_NAME);
    };

    // The start-up is still checking the stored session: wait for it (3 s at most), then decide.
    const startWhenSettled = async (): Promise<void> => {
        setBusy(true);
        if (carry) carry.pending = true;
        const status = await settled(TAKEN_CHECK_TIMEOUT_MS);
        if (!mounted.current) { busyNow.current = false; return; } // left, or re-created by a login (see carry)
        if (carry) carry.pending = false;
        setBusy(false);
        if (status === 'loading') {
            console.warn(`[account] accounts still starting after ${TAKEN_CHECK_TIMEOUT_MS} ms, starting without them`);
        }
        await startAs(status);
    };

    const requestStart = (): void => {
        if (busyNow.current || modalOpen.current) return;
        setNameRefused(false);
        void (account.status === 'loading' ? startWhenSettled() : startAs(account.status));
    };

    // A Start that waited for the accounts on the screen this one replaced goes on here (now with the account).
    const resume = useRef(requestStart);
    useEffect(() => {
        if (!carry?.pending) return;
        carry.pending = false;
        resume.current();
    }, [carry]);

    const nameProblem: NicknameError | null = nameRefused && account.status !== 'loggedIn' ? guestNameProblem(name) : null;

    return { modal, openModal, closeModal, checking, takenName, nameProblem, requestStart };
}
