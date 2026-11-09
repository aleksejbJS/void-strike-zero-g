// The account button under the summary: Log out when logged in, the call to action for a guest.
// Nothing while accounts are disabled or still starting up (neither action works then).

import React from 'react';
import { useAccount } from '../../account/useAccount';
import { useTranslation } from '../../i18n/useTranslation';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

const LockIcon: React.FC = () => (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" className="shrink-0">
        <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M4 8V5.5a4 4 0 0 1 8 0V8" />
        <rect x="1" y="8" width="14" height="10" rx="2" fill="currentColor" />
    </svg>
);

interface Props {
    onProtect: () => void;
    onLogOut: () => void;
}

export const ProfileAccountActions: React.FC<Props> = ({ onProtect, onLogOut }) => {
    const { t } = useTranslation();
    const { status } = useAccount();

    if (status === 'loggedIn') {
        return (
            <button type="button" onClick={onLogOut}
                className={`ap-button h-10 self-start rounded border-2 border-bay-edge bg-bay-steel px-4 text-[15px] font-semibold hover:bg-bay-plate phone:h-7 phone:px-3 phone:text-xs ${focusRing}`}>
                {t('pf.logout')}
            </button>
        );
    }
    if (status !== 'guest') return null;
    return (
        <div className="ap-panel flex flex-col gap-1.5 rounded border-2 border-bay-edge bg-bay-panel p-3 phone:gap-1 phone:p-2">
            <p className="m-0 text-[13px] leading-snug text-bay-dust phone:text-[11px] phone:leading-tight">{t('pf.protect.hint')}</p>
            {/* The height follows the text: a long label wraps onto a second line instead of being cut off */}
            <button type="button" onClick={onProtect}
                className={`ap-button ap-primary flex min-h-11 items-center justify-center gap-2 rounded bg-bay-hazard px-4 py-2 text-center leading-[1.1] text-bay-ink [text-wrap:balance] hover:bg-[#FFD24D] phone:min-h-7 phone:gap-1.5 phone:py-1 ${focusRing}`}>
                <LockIcon />
                <span>{t('pf.protect')}</span>
            </button>
        </div>
    );
};
