// Key hints along the bottom of the menu

import React from 'react';
import type { Translate } from './types';

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="rounded-[3px] border border-b-[3px] border-bay-edge bg-bay-steel px-2 py-0.5 font-body text-[13px] font-semibold text-bay-chalk">{children}</kbd>
);

export const ControlsLegend: React.FC<{ t: Translate }> = ({ t }) => (
    <div className="ap-controls flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-bay-dust">
        <span className="flex items-center gap-2"><Key>WASD</Key>{t('ctl.move')}</span>
        <span className="flex items-center gap-2"><Key>Space</Key>{t('ctl.jetpack')}</span>
        <span className="flex items-center gap-2"><Key>{t('ctl.leftClick')}</Key>{t('ctl.fire')}</span>
        <span title={`${t('ctl.rightClick')} ${t('ctl.or')} Shift`} className="flex items-center gap-2"><Key>Shift</Key>{t('ctl.grapple')}</span>
        <span className="flex items-center gap-2"><Key>S</Key>{t('ctl.crouch')}</span>
        <span title={t('ctl.prone')} className="flex items-center gap-2"><Key>Z</Key>{t('ctl.proneShort')}</span>
        <span title={`1–9 ${t('ctl.or')} ${t('ctl.wheel')}`} className="flex items-center gap-2"><Key>1–9</Key>{t('ctl.weapons')}</span>
    </div>
);
