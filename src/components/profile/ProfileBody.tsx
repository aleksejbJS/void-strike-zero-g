// The two columns of the profile. The saved progress is read once when this mounts: the screen mounts it
// again (new key) after a login or logout, which is when that progress changes.

import React, { useState } from 'react';
import { AchievementGrid } from './AchievementGrid';
import { ProfileAccountActions } from './ProfileAccountActions';
import { ProfileSummary } from './ProfileSummary';
import { readProfile } from './profileData';

interface Props {
    nickname: string;
    onProtect: () => void;
    onLogOut: () => void;
}

// From lg up, and on a phone held sideways, the screen fits the window and each column scrolls on its own
// (the padding keeps focus outlines from being clipped at the scroll edge)
const column = 'ap-panel ap-profile-column min-w-0 p-1 lg:min-h-0 lg:overflow-y-auto phone:min-h-0 phone:overflow-y-auto';

export const ProfileBody: React.FC<Props> = ({ nickname, onProtect, onLogOut }) => {
    const [data] = useState(readProfile);
    return (
        <main className="grid flex-grow grid-cols-1 gap-6 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] phone:min-h-0 phone:grid-cols-[minmax(0,210px)_minmax(0,1fr)] phone:grid-rows-[minmax(0,1fr)] phone:gap-3">
            <div className={column}>
                <ProfileSummary nickname={nickname} data={data}>
                    <ProfileAccountActions onProtect={onProtect} onLogOut={onLogOut} />
                </ProfileSummary>
            </div>
            <div className={column}>
                <AchievementGrid achievements={data.achievements} />
            </div>
        </main>
    );
};
