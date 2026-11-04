// The name a player enters tournaments with, and signing up with it. Logged in, that is the account nickname;
// a guest uses the name from the setup screen. A guest who never picked one ("Anonymous") is sent to the
// setup screen first.

import { useCallback } from 'react';
import { useAccount } from '../../account/useAccount';
import { useUIStore } from '../../store/uiStore';
import { joinTournament } from '../../tournament/tournamentApi';
import { saveTicket } from '../../tournament/seatStore';
import type { SeatTicket } from '../../tournament/types';
import { nicknameFor } from '../setup/account/useStartGate';
import type { TournamentCall } from './useTournamentCall';

/** '' when the player has no name yet. */
export const useTournamentNickname = (): string => {
    const account = useAccount();
    const { state } = useUIStore();
    if (account.status === 'loggedIn' && account.nickname) return account.nickname;
    return nicknameFor(state.playerName);
};

/** Signs up through `call` (busy and error go there) and keeps the seat ticket in this browser. */
export const useSignUp = (call: TournamentCall, onCustomize: () => void, onSeated: (ticket: SeatTicket) => void) => {
    const nickname = useTournamentNickname();
    const { run } = call;
    return useCallback((id: string) => {
        if (!nickname) {
            onCustomize();
            return;
        }
        void run(async () => {
            const ticket = await joinTournament(id, nickname);
            saveTicket(ticket);
            onSeated(ticket);
        });
    }, [nickname, run, onCustomize, onSeated]);
};
