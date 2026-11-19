// Key hints along the bottom of the menu: the player's own bindings (profile → Controls)

import React from 'react';
import { legendItems } from '../controls/legendItems';
import { useBindings } from '../controls/useBindings';
import type { Translate } from './types';

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="rounded-[3px] border border-b-[3px] border-bay-edge bg-bay-steel px-2 py-0.5 font-body text-[13px] font-semibold text-bay-chalk">{children}</kbd>
);

export const ControlsLegend: React.FC<{ t: Translate }> = ({ t }) => {
    // The profile opens over the menu, which stays mounted: the hook re-reads the bindings on every save
    const bindings = useBindings();
    return (
        <div className="ap-controls flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-bay-dust">
            {legendItems(bindings, t).map(item => (
                <span key={item.label} title={item.title} className="flex items-center gap-2"><Key>{item.shown}</Key>{t(item.label)}</span>
            ))}
            <span title={`1–9 ${t('ctl.or')} ${t('ctl.wheel')}`} className="flex items-center gap-2"><Key>1–9</Key>{t('ctl.weapons')}</span>
        </div>
    );
};
