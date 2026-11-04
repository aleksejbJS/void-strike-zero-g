// Right column of the menu: map choice, play vs bots, and playing with friends.

import React, { useState } from 'react';
import { MapId } from '../../types';
import type { Translate } from './types';

export interface MapOption {
    id: MapId;
    label: string;
}

interface Props {
    t: Translate;
    maps: MapOption[];
    selectedMap: MapId;
    playSubtitle: string;
    onSelectMap: (map: MapId) => void;
    onPlay: () => void;
    onCreateGame: () => void;
    onJoin: (target: string) => void;
    /** Absent when tournaments are not available (no Supabase in this build): no button then. */
    onTournaments?: () => void;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

export const PlayPanel: React.FC<Props> = ({ t, maps, selectedMap, playSubtitle, onSelectMap, onPlay, onCreateGame, onJoin, onTournaments }) => {
    const [invite, setInvite] = useState('');
    const submitJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (invite.trim()) onJoin(invite.trim());
    };

    return (
        <div className="flex flex-col gap-4 rounded bg-bay-panel p-[22px] phone:gap-2 phone:self-start phone:p-2.5">
            <div className="flex flex-col gap-2">
                <span className="text-sm text-bay-dust phone:hidden">{t('hb.map')}</span>
                <div role="group" aria-label={t('hb.map')} className="flex gap-1 rounded bg-bay-steel p-1">
                    {maps.map(m => (
                        <button key={m.id} type="button" aria-pressed={m.id === selectedMap} onClick={() => onSelectMap(m.id)}
                            className={`h-10 flex-1 rounded-sm text-[15px] font-semibold phone:h-7 phone:text-[13px] ${focusRing} ${m.id === selectedMap ? 'bg-bay-chalk text-bay-ink' : 'text-bay-dust hover:text-bay-chalk'}`}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            <button type="button" onClick={onPlay}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded bg-bay-hazard px-3 py-3 phone:min-h-[52px] phone:gap-0 phone:py-1.5 text-center text-bay-ink transition-colors hover:bg-[#FFD24D] ${focusRing}`}>
                <span className="font-display text-[36px] font-black leading-none phone:text-2xl">{t('hb.playBots')}</span>
                <span className="text-sm font-medium text-[#2A2410] phone:text-[11px] phone:leading-tight">{playSubtitle}</span>
            </button>

            {onTournaments && (
                <button type="button" onClick={onTournaments}
                    className={`h-[50px] rounded border-2 border-bay-hazard text-base font-semibold text-bay-hazard transition-colors hover:bg-bay-hazard hover:text-bay-ink phone:h-auto phone:min-h-9 phone:px-2 phone:py-1 phone:text-[13px] ${focusRing}`}>
                    {t('tournament.menu')}
                </button>
            )}

            <div aria-hidden="true" className="my-1.5 h-px bg-bay-plate phone:hidden" />

            <h2 className="m-0 font-display text-2xl font-extrabold phone:sr-only">{t('hb.playFriends')}</h2>
            <button type="button" onClick={onCreateGame}
                className={`h-[50px] rounded border-2 border-bay-chalk phone:h-auto phone:min-h-9 phone:px-2 phone:py-1 phone:text-[13px] phone:leading-tight text-base font-semibold text-bay-chalk transition-colors hover:bg-bay-chalk hover:text-bay-ink ${focusRing}`}>
                {t('hb.createGame')}
            </button>
            <form onSubmit={submitJoin} className="flex flex-col gap-1.5">
                <label htmlFor="menu-join" className="text-sm text-bay-dust phone:sr-only">{t('hb.inviteLabel')}</label>
                <div className="flex gap-2">
                    <input id="menu-join" value={invite} onChange={e => setInvite(e.target.value)} placeholder={t('hb.invitePlaceholder')}
                        className="h-[50px] min-w-0 flex-grow rounded border-2 border-bay-edge bg-bay-ink px-3 text-[15px] phone:h-9 phone:px-2 phone:text-[13px] text-bay-chalk placeholder:text-bay-dust/70 focus:border-bay-hazard focus:outline-none" />
                    <button type="submit"
                        className={`h-[50px] rounded bg-bay-plate px-[18px] text-base phone:h-9 phone:px-3 phone:text-sm font-semibold text-bay-chalk transition-colors hover:bg-bay-edge ${focusRing}`}>
                        {t('hb.join')}
                    </button>
                </div>
            </form>
        </div>
    );
};
