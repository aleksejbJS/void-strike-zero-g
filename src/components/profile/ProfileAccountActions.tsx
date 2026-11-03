// The account button under the summary: Log out when logged in, the call to action for a guest.
// Nothing while accounts are disabled or still starting up (neither action works then).

import React from 'react';
import { useAccount } from '../../account/useAccount';
import { useTranslation } from '../../i18n/useTranslation';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

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
                className={`h-10 self-start rounded border-2 border-bay-edge bg-bay-steel px-4 text-[15px] font-semibold hover:bg-bay-plate phone:h-7 phone:px-3 phone:text-xs ${focusRing}`}>
                {t('pf.logout')}
            </button>
        );
    }
    if (status !== 'guest') return null;
    return (
        <div className="flex flex-col gap-1.5 rounded border-2 border-bay-edge bg-bay-panel p-3 phone:gap-1 phone:p-2">
            <p className="m-0 text-[13px] leading-snug text-bay-dust phone:text-[11px] phone:leading-tight">{t('pf.protect.hint')}</p>
            <button type="button" onClick={onProtect}
                className={`h-10 rounded bg-bay-hazard px-4 font-display text-xl font-black text-bay-ink hover:bg-[#FFD24D] phone:h-7 phone:text-base ${focusRing}`}>
                <span aria-hidden="true">🔒</span> {t('pf.protect')}
            </button>
        </div>
    );
};
