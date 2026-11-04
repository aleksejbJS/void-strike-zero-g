// Router of the tournament screens (uiStore.tournamentNav): the list, one tournament, and watching it.
// One tournament shows its lobby before the start and its bracket once running (or finished). Under all of
// them runs the autopilot (my lobby heartbeat, my duel's start, queued results), over all of them the
// "Achievement unlocked" toast (a Champion unlock happens on the bracket).

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useUIStore } from '../../store/uiStore';
import { TOURNAMENT_NOT_FOUND } from '../../tournament/types';
import { useTournament } from '../../tournament/useTournament';
import { ErrorLine, TournamentFrame, ghostButton } from './TournamentFrame';
import { TournamentList } from './TournamentList';
import { TournamentLobby } from './TournamentLobby';
import { BracketScreen } from './BracketScreen';
import { AchievementToast } from '../hud/Achievements';
import { useAchievementToast } from './useAchievementToast';
import { WatchScreen } from './watch/WatchScreen';
import { TournamentAutopilot } from './autopilot/TournamentAutopilot';
import { isLobbyExpired } from '../../game/tournament/startRule';

interface Props {
    /** Opens the setup screen: a guest without a name picks one there first. */
    onCustomize: () => void;
}

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="m-0 text-[15px] text-bay-dust">{children}</p>;

const TournamentView: React.FC<{ id: string } & Props> = ({ id, onCustomize }) => {
    const { t } = useTranslation();
    const { actions } = useUIStore();
    const { snapshot, error } = useTournament(id);

    const body = (() => {
        if (!snapshot) {
            if (!error) return <Note>{t('tournament.loading')}</Note>;
            if (error.message === TOURNAMENT_NOT_FOUND) return <p role="alert" className="m-0 text-[15px] font-semibold text-bay-signal">{t('tournament.notFound')}</p>;
            return <ErrorLine code={error.code} />;
        }
        // A lobby nobody started within 30 min can no longer start: it is expired, whatever its row says
        const status = isLobbyExpired(snapshot.tournament, Date.now()) ? 'expired' : snapshot.tournament.status;
        switch (status) {
            case 'lobby':
                return <TournamentLobby snapshot={snapshot} onCustomize={onCustomize} />;
            case 'expired':
                return (
                    <>
                        <Note>{t('tournament.expired')}</Note>
                        <button type="button" className={`${ghostButton} self-start`} onClick={actions.openTournaments}>{t('tournament.toList')}</button>
                    </>
                );
            default: // running and finished
                return <BracketScreen snapshot={snapshot} />;
        }
    })();

    return <TournamentFrame title={t('tournament.menu')} onBack={actions.openTournaments}>{body}</TournamentFrame>;
};

const Route: React.FC<Props> = ({ onCustomize }) => {
    const { state } = useUIStore();
    const nav = state.tournamentNav;
    if (!nav) return null;

    switch (nav.view) {
        case 'list':
            return <TournamentList onCustomize={onCustomize} />;
        case 'tournament':
            return <TournamentView key={nav.id} id={nav.id} onCustomize={onCustomize} />;
        case 'watch':
            return <WatchScreen key={nav.id} id={nav.id} />;
    }
};

export const TournamentScreens: React.FC<Props> = ({ onCustomize }) => {
    const { t } = useTranslation();
    const achievement = useAchievementToast();
    return (
        <>
            <TournamentAutopilot />
            <Route onCustomize={onCustomize} />
            {achievement && (
                <div className="pointer-events-none fixed right-4 top-4 z-[80]">
                    <AchievementToast t={t} achievement={achievement} />
                </div>
            )}
        </>
    );
};
