// Small "Hazard Bay" window with two tabs: create an account (the guest's progress moves into it) or
// log in to an existing one. Shared by the setup screen and the profile screen.

import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { AccountTab, useAccountForm } from './useAccountForm';

export interface AccountModalProps {
    initialTab: AccountTab;
    initialNickname: string;
    onClose: () => void;
    /** Why the window opened by itself (e.g. "this name is taken"), shown above the tabs. */
    notice?: string;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const TEXT = {
    signup: { tab: 'ac.tab.signup', hint: 'ac.hint.signup', submit: 'ac.submit.signup' },
    login: { tab: 'ac.tab.login', hint: 'ac.hint.login', submit: 'ac.submit.login' },
} as const;
const inputClass = 'h-11 rounded border-2 border-bay-edge bg-bay-ink px-3 text-base font-semibold text-bay-chalk placeholder:font-medium placeholder:text-bay-plate focus:border-bay-hazard focus:outline-none phone:h-8 phone:text-sm';

export const AccountModal: React.FC<AccountModalProps> = ({ initialTab, initialNickname, onClose, notice }) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState<AccountTab>(initialTab);
    const [nickname, setNickname] = useState(initialNickname);
    const [password, setPassword] = useState('');
    const form = useAccountForm(onClose);
    const nickInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);
    const id = useId();

    // Focus the first empty field on open (what was typed later does not matter) and give focus back on close
    useEffect(() => {
        const opener = document.activeElement;
        (initialNickname.trim() === '' ? nickInput : passwordInput).current?.focus();
        return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
    }, [initialNickname]);

    // Esc closes, also while a call runs (the provider finishes it; its late result is ignored)
    const { dismiss } = form;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dismiss]);

    const switchTab = (next: AccountTab) => { setTab(next); form.clearError(); };
    const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void form.submit(tab, nickname, password); };
    const typed = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); form.clearError(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,12,15,0.8)] p-4 phone:p-2">
            <div role="dialog" aria-modal="true" aria-label={t('ac.dialog')}
                className="max-h-full w-full max-w-[360px] overflow-y-auto rounded border-2 border-t-4 border-bay-edge border-t-bay-hazard bg-bay-panel p-4 text-bay-chalk phone:p-3">
                {notice && <p role="status" className="m-0 mb-3 text-sm font-semibold leading-snug text-bay-signal phone:mb-2 phone:text-xs">{notice}</p>}
                <div role="tablist" className="mb-3 flex border-b-2 border-bay-edge phone:mb-2">
                    {(['signup', 'login'] as const).map(name => (
                        <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => switchTab(name)}
                            className={`-mb-0.5 border-b-[3px] px-2.5 py-1 font-display text-xl font-black uppercase phone:text-base ${focusRing} ${tab === name ? 'border-bay-hazard text-bay-chalk' : 'border-transparent text-bay-dust hover:text-bay-chalk'}`}>
                            {t(TEXT[name].tab)}
                        </button>
                    ))}
                </div>
                <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 phone:gap-1.5">
                    <label htmlFor={`${id}-nick`} className="sr-only">{t('ac.nickname')}</label>
                    <input id={`${id}-nick`} ref={nickInput} value={nickname} onChange={typed(setNickname)} placeholder={t('ac.nickname')}
                        autoComplete="username" autoCapitalize="off" spellCheck={false} className={inputClass} />
                    <label htmlFor={`${id}-pw`} className="sr-only">{t('ac.password')}</label>
                    <input id={`${id}-pw`} ref={passwordInput} type="password" value={password} onChange={typed(setPassword)} placeholder={t('ac.password')}
                        autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} className={inputClass} />
                    <p className="m-0 text-[13px] leading-snug text-bay-dust phone:text-[11px]">{t(TEXT[tab].hint)}</p>
                    {form.error && <p role="alert" className="m-0 text-[13px] font-semibold leading-snug text-bay-signal phone:text-[11px]">{form.error}</p>}
                    <div className="mt-1 flex gap-2">
                        <button type="submit" disabled={form.pending}
                            className={`h-10 rounded bg-bay-hazard px-5 font-display text-xl font-black text-bay-ink hover:bg-[#FFD24D] disabled:cursor-wait disabled:opacity-60 phone:h-8 phone:text-base ${focusRing}`}>
                            {form.pending ? t('ac.busy') : t(TEXT[tab].submit)}
                        </button>
                        <button type="button" onClick={dismiss}
                            className={`h-10 rounded border-2 border-bay-edge px-4 font-semibold hover:bg-bay-steel phone:h-8 phone:text-sm ${focusRing}`}>
                            {t('ac.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
