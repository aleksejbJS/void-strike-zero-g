// Main menu ("Hazard Bay" design): pick a mode, see how it plays, start vs bots or with friends.

import { assetUrl } from '../../assetUrl';
import './atompunk-menu.css';
import './atompunk-responsive.css';
import './atompunk-details.css';
import './atompunk-typography.css';
import React, { useCallback, useEffect, useState } from 'react';
import { GameMode, MapId, NetworkMode } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from '../../i18n/useTranslation';
import { MODE_INFO } from './modeInfo';
import { PATCH_NOTES } from './patchNotes';
import { ModeList } from './ModeList';
import { ModePreview } from './ModePreview';
import { PlayPanel, MapOption } from './PlayPanel';
import { ControlsLegend } from './ControlsLegend';
import { ProfileButton } from './ProfileButton';
import { TopButton } from './TopButton';
import { WhatsNew } from './WhatsNew';
import { TournamentUnavailable } from './TournamentUnavailable';
import { ADS_ADMIN_HASH, canSeeAdSettings } from '../ads/adminAccess';
import { getSupabase } from '../../account/supabaseClient';
import type { Translate } from './types';

/** Maps a mode can be played on, first one is the default. */
const mapsFor = (mode: GameMode, t: Translate): MapOption[] => {
    if (mode === GameMode.HUNGER_GAMES) return [{ id: MapId.HUNGER, label: t('hb.mapHunger') }];
    const standard = { id: MapId.DEFAULT, label: t('hb.mapDefault') };
    if (mode === GameMode.DEATHMATCH || mode === GameMode.GUN_GAME) return [standard, { id: MapId.TUNNELS, label: t('hb.mapTunnels') }];
    return [standard]; // objective modes are built for the default map
};

interface Props {
    onCustomize: () => void;
    onOpenProfile: () => void;
    onOpenLeaderboard: () => void;
}

const MainMenu: React.FC<Props> = ({ onCustomize, onOpenProfile, onOpenLeaderboard }) => {
    const { state, actions } = useUIStore();
    const { t, language, changeLanguage } = useTranslation();
    const [mode, setMode] = useState<GameMode>(state.selectedMode);
    const [newsOpen, setNewsOpen] = useState(false);
    const closeNews = useCallback(() => setNewsOpen(false), []);
    const [tournamentNotice, setTournamentNotice] = useState(false);
    const closeTournamentNotice = useCallback(() => setTournamentNotice(false), []);
    const [showAdSettings] = useState(canSeeAdSettings);
    const [tournamentsAvailable] = useState(() => getSupabase() !== null); // tournaments live in Supabase

    // Returning from a game: show the mode that was played
    useEffect(() => setMode(state.selectedMode), [state.selectedMode]);

    const maps = mapsFor(mode, t);
    const mapAllowed = maps.some(m => m.id === state.selectedMap);
    useEffect(() => {
        if (!mapAllowed) actions.selectMap(maps[0].id);
    }, [mapAllowed, maps, actions]);

    const info = MODE_INFO[language];
    const currentMap = maps.find(m => m.id === state.selectedMap) ?? maps[0];

    const go = (network: NetworkMode, target: string | null) => {
        actions.selectMode(mode);
        actions.setNetworkState(network, target);
        onCustomize();
    };

    return (
        <div lang={language} className="atompunk-menu h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="ap-shell relative mx-auto flex min-h-full max-w-[1440px] flex-col gap-7 px-4 pb-9 pt-8 sm:px-[72px] sm:pt-12 phone:h-full phone:gap-2 phone:px-4 phone:pb-2 phone:pt-2">
                <header className="ap-header relative flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between phone:flex-row phone:items-center phone:justify-between">
                    <div className="ap-brand flex flex-col">
                        <h1 className="ap-logo m-0">
                            <span className="sr-only">Void Strike</span>
                            <img src={assetUrl('assets/menu/void-strike-logo.webp')} alt="" width="2172" height="724" />
                        </h1>
                    </div>
                    {/* max-w-full: on a narrow portrait phone the row stays within the screen, the nickname truncates */}
                    <div className="ap-header-actions flex min-w-0 max-w-full shrink-0 gap-2">
                        <TopButton onOpen={onOpenLeaderboard} t={t} />
                        <ProfileButton onOpen={onOpenProfile} t={t} />
                        <button type="button" onClick={() => setNewsOpen(true)}
                            className="flex h-11 items-center gap-2 rounded phone:h-9 border-2 border-bay-edge bg-bay-steel px-4 text-[15px] font-semibold hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                            {t('hb.whatsNew')}
                        </button>
                        <button type="button" onClick={() => changeLanguage(language === 'en' ? 'ru' : 'en')} aria-label={t('hb.switchLanguage')}
                            className="h-11 min-w-[56px] rounded phone:h-9 border-2 border-bay-edge bg-bay-steel px-3.5 text-[15px] font-semibold hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                            {language === 'en' ? 'RU' : 'EN'}
                        </button>
                    </div>
                </header>

                <main className="ap-main relative grid flex-grow grid-cols-1 gap-7 lg:grid-cols-[300px_minmax(0,1fr)_320px] phone:min-h-0 phone:grid-cols-[minmax(0,170px)_minmax(0,1fr)_minmax(0,210px)] phone:gap-3">
                    <ModeList title={t('hb.chooseMode')} selected={mode} info={info} onSelect={setMode} />
                    <ModePreview mode={mode} map={currentMap.id} info={info[mode]} t={t} />
                    <PlayPanel
                        t={t}
                        maps={maps}
                        selectedMap={currentMap.id}
                        playSubtitle={t('hb.playSub', info[mode].name, currentMap.label.toLowerCase())}
                        onSelectMap={actions.selectMap}
                        onPlay={() => go(NetworkMode.OFFLINE, null)}
                        onCreateGame={() => go(NetworkMode.HOST, null)}
                        onJoin={target => go(NetworkMode.CLIENT, target)}
                        onTournaments={tournamentsAvailable ? actions.openTournaments : () => setTournamentNotice(true)}
                    />
                </main>

                <div className="ap-footer ap-panel flex flex-wrap items-center justify-between gap-4 phone:hidden">
                    <ControlsLegend t={t} />
                    {showAdSettings && (
                        <a href={ADS_ADMIN_HASH}
                            className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-bay-dust hover:text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
                            </svg>
                            {t('hb.adSettings')}
                        </a>
                    )}
                </div>
            </div>
            {newsOpen && <WhatsNew t={t} notes={PATCH_NOTES[language]} onClose={closeNews} />}
            {tournamentNotice && <TournamentUnavailable onClose={closeTournamentNotice} />}
        </div>
    );
};

export default MainMenu;
