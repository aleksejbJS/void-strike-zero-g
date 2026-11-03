// Header button of the main menu: opens the profile. Shows the nickname with a lock when logged in,
// "Profile" for a guest (also while accounts are disabled).

import React from 'react';
import { useAccount } from '../../account/useAccount';
import type { Translate } from './types';

export const ProfileButton: React.FC<{ onOpen: () => void; t: Translate }> = ({ onOpen, t }) => {
    const { status, nickname } = useAccount();
    const named = status === 'loggedIn' ? nickname : null;
    return (
        <button type="button" onClick={onOpen} aria-label={named ? t('pf.menu.named', named) : undefined}
            className="flex h-11 min-w-0 max-w-[200px] items-center gap-2 rounded border-2 border-bay-edge bg-bay-steel px-4 text-[15px] font-semibold hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard phone:h-9 phone:max-w-[140px] phone:px-3">
            {named ? (
                <>
                    <span aria-hidden="true">🔒</span>
                    <span className="truncate">{named}</span>
                </>
            ) : t('pf.menu')}
        </button>
    );
};
