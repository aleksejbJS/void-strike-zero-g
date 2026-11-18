// Profile screen ("Hazard Bay" design): the player's name, level and every achievement, plus the account
// actions (log out, or protect the nickname with a password). Works as a guest, with accounts disabled too.

import React, { useCallback, useState } from 'react';
import { useAccount } from '../../account/useAccount';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from '../../i18n/useTranslation';
import { AccountModal } from '../setup/account/AccountModal';
import { nicknameFor } from '../setup/account/useStartGate';
import { LogoutConfirm } from './LogoutConfirm';
import { ProfileBody } from './ProfileBody';
import { MenuScreenHeader } from '../menu/MenuScreenHeader';

export const ProfileScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { status, nickname } = useAccount();
    const { state } = useUIStore();
    const [protecting, setProtecting] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const openProtect = useCallback(() => setProtecting(true), []);
    const closeProtect = useCallback(() => setProtecting(false), []);
    const openLogOut = useCallback(() => setLoggingOut(true), []);
    const closeLogOut = useCallback(() => setLoggingOut(false), []);

    const loggedIn = status === 'loggedIn' && nickname !== null;
    const name = loggedIn ? nickname : state.playerName;

    return (
        <div className="atompunk-ui h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="ap-page-shell mx-auto flex min-h-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-6 sm:px-10 lg:h-full lg:px-[72px] lg:pb-6 lg:pt-8 phone:h-full phone:gap-2 phone:px-3 phone:pb-2 phone:pt-2">
                <MenuScreenHeader title={t('pf.menu')} titleAs="h2" backLabel={t('cs.back')} onBack={onBack}>
                    {loggedIn && <span><span aria-hidden="true">☁</span> {t('pf.cloud')}</span>}
                </MenuScreenHeader>

                {/* A new key after a login or logout: the progress under the screen changed, read it again */}
                <ProfileBody key={`${status}:${nickname ?? ''}`} nickname={name} onProtect={openProtect} onLogOut={openLogOut} />
            </div>
            {protecting && <AccountModal key={nicknameFor(state.playerName)} initialTab="signup" initialNickname={nicknameFor(state.playerName)} onClose={closeProtect} />}
            {loggingOut && <LogoutConfirm onClose={closeLogOut} />}
        </div>
    );
};
