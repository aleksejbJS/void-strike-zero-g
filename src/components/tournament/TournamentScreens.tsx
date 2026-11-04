// Router of the tournament screens (uiStore.tournamentNav): the list, one tournament, and watching it.
// One tournament shows its lobby before the start. The bracket (running / finished) and the watch screen
// are placeholders until they exist.

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useUIStore } from '../../store/uiStore';
import { TOURNAMENT_NOT_FOUND } from '../../tournament/types';
import { useTournament } from '../../tournament/useTournament';
import { ErrorLine, TournamentFrame, ghostButton } from './TournamentFrame';
import { TournamentList } from './TournamentList';
import { TournamentLobby } from './TournamentLobby';

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
        switch (snapshot.tournament.status) {
            case 'lobby':
                return <TournamentLobby snapshot={snapshot} onCustomize={onCustomize} />;
            case 'expired':
                return (
                    <>
                        <Note>{t('tournament.expired')}</Note>
                        <button type="button" className={`${ghostButton} self-start`} onClick={actions.openTournaments}>{t('tournament.toList')}</button>
                    </>
                );
            default: // running and finished: the bracket screen replaces this
                return (
                    <>
                        <h2 className="m-0 font-display text-[28px] font-extrabold uppercase leading-tight phone:text-lg">{snapshot.tournament.name}</h2>
                        <Note>{t('tournament.placeholder.bracket')}</Note>
                    </>
                );
        }
    })();

    return <TournamentFrame title={t('tournament.menu')} onBack={actions.openTournaments}>{body}</TournamentFrame>;
};

export const TournamentScreens: React.FC<Props> = ({ onCustomize }) => {
    const { t } = useTranslation();
    const { state, actions } = useUIStore();
    const nav = state.tournamentNav;
    if (!nav) return null;

    switch (nav.view) {
        case 'list':
            return <TournamentList onCustomize={onCustomize} />;
        case 'tournament':
            return <TournamentView key={nav.id} id={nav.id} onCustomize={onCustomize} />;
        case 'watch': // the split-screen watch screen replaces this
            return (
                <TournamentFrame title={t('tournament.menu')} onBack={() => actions.openTournament(nav.id)}>
                    <Note>{t('tournament.placeholder.watch')}</Note>
                </TournamentFrame>
            );
    }
};
