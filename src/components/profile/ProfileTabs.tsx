// Right column of the profile: the achievements, and the Controls tab for key bindings
// (not on devices without a mouse or trackpad: there is no keyboard to bind).

import React, { useState } from 'react';
import type { Achievement } from '../../game/systems/achievements';
import { useTranslation } from '../../i18n/useTranslation';
import { ControlsPanel } from '../controls/ControlsPanel';
import { hasFinePointer } from '../pointer';
import { AchievementGrid } from './AchievementGrid';

type Tab = 'achievements' | 'controls';

const tabLook = 'ap-button h-9 rounded border-2 px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard phone:h-7 phone:px-2.5 phone:text-xs';

export const ProfileTabs: React.FC<{ achievements: readonly Achievement[] }> = ({ achievements }) => {
    const { t } = useTranslation();
    const [showControls] = useState(hasFinePointer);
    const [tab, setTab] = useState<Tab>('achievements');
    if (!showControls) return <AchievementGrid achievements={achievements} />;

    const tabs: readonly Tab[] = ['achievements', 'controls'];
    return (
        <div className="flex min-w-0 flex-col gap-3 phone:gap-1.5">
            <div role="tablist" aria-label={t('kb.tabs')} className="flex gap-1.5">
                {tabs.map(name => (
                    <button key={name} type="button" role="tab" id={`profile-tab-${name}`} aria-controls={`profile-panel-${name}`}
                        aria-selected={tab === name} onClick={() => setTab(name)}
                        className={`${tabLook} ${tab === name ? 'border-bay-hazard bg-bay-hazard text-bay-ink' : 'border-bay-edge bg-bay-steel hover:bg-bay-plate'}`}>
                        {t(`kb.tab.${name}`)}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} className="min-w-0">
                {tab === 'achievements' ? <AchievementGrid achievements={achievements} /> : <ControlsPanel />}
            </div>
        </div>
    );
};
