// "Log out of this account?" window. Runs the logout itself and stays open until the service has answered:
// the screen behind it may already show a guest by then (the device forgets the player before the request ends).

import React, { useEffect, useId, useRef, useState } from 'react';
import { AccountError } from '../../account/accountError';
import { useAccount } from '../../account/useAccount';
import { useTranslation } from '../../i18n/useTranslation';
import { accountErrorMessage } from '../setup/account/accountMessages';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

export const LogoutConfirm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const { logOut } = useAccount();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const running = useRef(false); // set at once: a second click can come before the re-render
    const mounted = useRef(true);
    const cancel = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    // Focus the harmless button on open and give focus back on close
    useEffect(() => {
        mounted.current = true; // StrictMode runs the cleanup once before the real mount
        const opener = document.activeElement;
        cancel.current?.focus();
        return () => {
            mounted.current = false;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    // Esc closes, except while the logout runs
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, pending]);

    const confirm = async (): Promise<void> => {
        if (running.current) return;
        running.current = true;
        setPending(true);
        setError(null);
        try {
            await logOut();
            if (mounted.current) onClose();
        } catch (failure) {
            // An AccountError is an expected outcome (no connection); anything else is a misuse of the account API.
            if (!(failure instanceof AccountError)) console.error('[account] unexpected error while logging out:', failure);
            if (mounted.current) setError(accountErrorMessage(t, failure));
        } finally {
            running.current = false;
            if (mounted.current) setPending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,12,15,0.8)] p-4 phone:p-2">
            <div role="dialog" aria-modal="true" aria-labelledby={titleId}
                className="max-h-full w-full max-w-[360px] overflow-y-auto rounded border-2 border-t-4 border-bay-edge border-t-bay-hazard bg-bay-panel p-4 text-bay-chalk phone:p-3">
                <h2 id={titleId} className="m-0 mb-1.5 font-display text-2xl font-black uppercase phone:text-lg">{t('pf.logout.title')}</h2>
                <p className="m-0 text-sm leading-snug text-bay-dust phone:text-xs">{t('pf.logout.body')}</p>
                {error && <p role="alert" className="m-0 mt-2 text-[13px] font-semibold leading-snug text-bay-signal phone:text-[11px]">{error}</p>}
                <div className="mt-3 flex gap-2 phone:mt-2">
                    <button type="button" onClick={() => void confirm()} disabled={pending}
                        className={`h-10 rounded bg-bay-hazard px-5 font-display text-xl font-black text-bay-ink hover:bg-[#FFD24D] disabled:cursor-wait disabled:opacity-60 phone:h-8 phone:text-base ${focusRing}`}>
                        {pending ? t('ac.busy') : t('pf.logout')}
                    </button>
                    <button ref={cancel} type="button" onClick={onClose} disabled={pending}
                        className={`h-10 rounded border-2 border-bay-edge px-4 font-semibold hover:bg-bay-steel disabled:cursor-wait disabled:opacity-60 phone:h-8 phone:text-sm ${focusRing}`}>
                        {t('ac.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
