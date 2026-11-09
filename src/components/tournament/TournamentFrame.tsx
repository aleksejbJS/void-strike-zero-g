// The page around every tournament screen ("Hazard Bay"): Back, the title, the hazard stripe and a panel;
// plus the button styles and the error line the screens share.

import React from 'react';
import { MenuScreenHeader } from '../menu/MenuScreenHeader';
import type { TranslationKeys } from '../../i18n/locales';
import { useTranslation } from '../../i18n/useTranslation';
import type { TournamentErrorCode } from '../../tournament/types';

export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const buttonBase = `ap-button h-10 shrink-0 rounded px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 phone:h-8 phone:px-3 phone:text-[13px] ${focusRing}`;
export const primaryButton = `${buttonBase} ap-primary bg-bay-hazard text-bay-ink hover:bg-[#FFD24D] disabled:hover:bg-bay-hazard`;
export const ghostButton = `${buttonBase} border-2 border-bay-edge text-bay-chalk hover:bg-bay-steel disabled:hover:bg-transparent`;

interface FrameProps {
    title: string;
    onBack: () => void;
    children: React.ReactNode;
}

/** "‹ Back" in hazard yellow, at the top left of every tournament screen. */
export const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    return (
        <button type="button" onClick={onBack} className={`ap-button ap-screen-back flex shrink-0 items-center gap-1.5 self-start text-[15px] font-semibold text-bay-hazard hover:text-bay-chalk ${focusRing}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
            </svg>
            {t('tournament.back')}
        </button>
    );
};

const FrameHeader: React.FC<Pick<FrameProps, 'title' | 'onBack'>> = ({ title, onBack }) => {
    const { t } = useTranslation();
    return <MenuScreenHeader title={title} backLabel={t('tournament.back')} onBack={onBack} />;
};

export const TournamentFrame: React.FC<FrameProps> = ({ title, onBack, children }) => (
    <div className="atompunk-ui h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
        <div className="ap-page-shell ap-narrow-shell mx-auto flex min-h-full max-w-[760px] flex-col gap-5 px-4 pb-8 pt-6 sm:px-10 lg:pt-10 phone:gap-2 phone:px-3 phone:pb-2 phone:pt-2">
            <FrameHeader title={title} onBack={onBack} />
            <section className="ap-panel ap-content-panel flex flex-col gap-4 overflow-hidden rounded bg-bay-panel px-5 pb-5 phone:gap-2 phone:px-3 phone:pb-3">
                {children}
            </section>
        </div>
    </div>
);

/** The message key of each tournament error code (also used by the duel's error banner). */
export const ERROR_KEYS: Record<TournamentErrorCode, keyof TranslationKeys> = {
    not_open: 'tournament.error.not_open',
    full: 'tournament.error.full',
    not_creator: 'tournament.error.not_creator',
    not_enough_players: 'tournament.error.not_enough_players',
    bad_ticket: 'tournament.error.bad_ticket',
    offline: 'tournament.error.offline',
    unknown: 'tournament.error.unknown',
};

export const ErrorLine: React.FC<{ code: TournamentErrorCode | null }> = ({ code }) => {
    const { t } = useTranslation();
    if (code === null) return null;
    return <p role="alert" className="m-0 text-sm font-semibold text-bay-signal">{t(ERROR_KEYS[code])}</p>;
};
