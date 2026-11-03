// The guest's one-line way into accounts, under the name field: protect the nickname or log in.

import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { AccountTab } from './useAccountForm';

const link = 'font-semibold text-bay-hazard hover:text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

export const AccountLine: React.FC<{ onOpen: (tab: AccountTab) => void }> = ({ onOpen }) => {
    const { t } = useTranslation();
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm phone:text-xs">
            <button type="button" onClick={() => onOpen('signup')} className={link}>
                <span aria-hidden="true">🔒</span> {t('ac.line.protect')}
            </button>
            <span aria-hidden="true" className="text-bay-plate">·</span>
            <button type="button" onClick={() => onOpen('login')} className={link}>{t('ac.line.logIn')}</button>
        </p>
    );
};
