// The "Name" row of the setup screen. A guest types a free-form name and sees the account line under it;
// a logged-in player sees a locked plate. While accounts are disabled or still starting up it is the plain input.

import React from 'react';
import { useAccount } from '../../../account/useAccount';
import { useTranslation } from '../../../i18n/useTranslation';
import { AccountLine } from './AccountLine';
import { NamePlate } from './NamePlate';
import type { AccountTab } from './useAccountForm';

export const MAX_NAME = 12;
const labelClass = 'font-display text-2xl font-extrabold short:text-xl phone:text-base';

interface Props {
    name: string;
    onName: (name: string) => void;
    /** Locks the input while the taken-name check runs, so the name checked is the name used. */
    busy: boolean;
    /** The guest name the last check found taken; the warning goes away when the name changes. */
    takenName: string | null;
    onOpenModal: (tab: AccountTab) => void;
    onOpenProfile?: () => void;
}

export const NameField: React.FC<Props> = ({ name, onName, busy, takenName, onOpenModal, onOpenProfile }) => {
    const { t } = useTranslation();
    const { status, nickname } = useAccount();
    const guest = status === 'guest';

    return (
        <div className="flex flex-col gap-2 phone:gap-1">
            <div className="flex flex-col gap-2 phone:flex-row phone:items-center">
                {status === 'loggedIn' && nickname ? (
                    <>
                        <span className={labelClass}>{t('cs.name')}</span>
                        <NamePlate nickname={nickname} onOpenProfile={onOpenProfile} />
                    </>
                ) : (
                    <>
                        <label htmlFor="setup-name" className={labelClass}>{t('cs.name')}</label>
                        <input id="setup-name" value={name} maxLength={MAX_NAME} readOnly={busy} onChange={e => onName(e.target.value.slice(0, MAX_NAME))}
                            className="h-[54px] rounded border-2 border-bay-edge bg-bay-panel px-4 text-xl font-semibold text-bay-chalk focus:border-bay-hazard focus:outline-none short:h-[46px] phone:h-8 phone:min-w-0 phone:flex-1 phone:px-2 phone:text-sm" />
                        <span className="text-[13px] text-bay-dust phone:hidden">{t('cs.nameHint', name.length, MAX_NAME)}</span>
                    </>
                )}
            </div>
            {guest && <AccountLine onOpen={onOpenModal} />}
            {guest && takenName !== null && name.trim() === takenName && (
                <p role="alert" className="m-0 text-sm font-semibold text-bay-signal phone:text-xs">{t('ac.taken')}</p>
            )}
        </div>
    );
};
