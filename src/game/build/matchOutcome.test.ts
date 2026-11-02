import { describe, it, expect } from 'vitest';
import { GameMode, GameState, Team } from '../../types';
import { detectMatchEnd } from './matchOutcome';

// Only the fields detectMatchEnd reads; the rest of GameState is irrelevant here.
const stateWith = (fields: Partial<GameState>, localTeam = Team.BLUE): GameState => ({
    mode: GameMode.DEATHMATCH,
    players: [{ id: 'me', team: localTeam }, { id: 'bot', team: Team.RED }],
    ...fields,
} as unknown as GameState);

describe('detectMatchEnd', () => {
    it('is null while nothing has ended', () => {
        expect(detectMatchEnd(stateWith({}), 'me')).toBeNull();
        expect(detectMatchEnd(stateWith({ matchStartedAt: 1000, hungerWinnerId: null, gunGameWinnerId: null }), 'me')).toBeNull();
    });

    it('free-for-all: won when matchWinner.playerId is the local id', () => {
        const base = { matchEndsAt: 5000 };
        expect(detectMatchEnd(stateWith({ ...base, matchWinner: { playerId: 'me' } }), 'me')).toEqual({ key: 'match:5000', won: true });
        expect(detectMatchEnd(stateWith({ ...base, matchWinner: { playerId: 'bot' } }), 'me')?.won).toBe(false);
    });

    it('team modes: won when matchWinner.team is the local player\'s team', () => {
        const base = { mode: GameMode.CTF, matchEndsAt: 5000, matchWinner: { team: Team.RED } };
        expect(detectMatchEnd(stateWith(base, Team.RED), 'me')?.won).toBe(true);
        expect(detectMatchEnd(stateWith(base, Team.BLUE), 'me')?.won).toBe(false);
    });

    it('team modes: not won when the local player is not in the room', () => {
        const state = stateWith({ matchEndsAt: 5000, matchWinner: { team: Team.RED } });
        expect(detectMatchEnd(state, 'ghost')).toEqual({ key: 'match:5000', won: false });
    });

    it('draw: not won', () => {
        expect(detectMatchEnd(stateWith({ matchEndsAt: 5000, matchWinner: null }), 'me')).toEqual({ key: 'match:5000', won: false });
        expect(detectMatchEnd(stateWith({ matchEndsAt: 5000 }), 'me')?.won).toBe(false);
    });

    it('Hunger Games: won when hungerWinnerId is the local id; no survivors: not won', () => {
        const base = { mode: GameMode.HUNGER_GAMES, hungerRoundEndsAt: 8000 };
        expect(detectMatchEnd(stateWith({ ...base, hungerWinnerId: 'me' }), 'me')).toEqual({ key: 'hunger:8000', won: true });
        expect(detectMatchEnd(stateWith({ ...base, hungerWinnerId: 'bot' }), 'me')?.won).toBe(false);
        expect(detectMatchEnd(stateWith({ ...base, hungerWinnerId: null }), 'me')).toEqual({ key: 'hunger:8000', won: false });
    });

    it('Gun Game: won when gunGameWinnerId is the local id', () => {
        const base = { mode: GameMode.GUN_GAME, matchStartedAt: 300 };
        expect(detectMatchEnd(stateWith({ ...base, gunGameWinnerId: 'me' }), 'me')).toEqual({ key: 'gun:300:me', won: true });
        expect(detectMatchEnd(stateWith({ ...base, gunGameWinnerId: 'bot' }), 'me')).toEqual({ key: 'gun:300:bot', won: false });
    });

    it('awards once per end key', () => {
        const state = stateWith({ matchEndsAt: 5000, matchWinner: { playerId: 'me' } });
        expect(detectMatchEnd(state, 'me')?.key).toBe(detectMatchEnd(state, 'me')?.key);
        const next = stateWith({ matchEndsAt: 16000, matchWinner: { playerId: 'me' } });
        expect(detectMatchEnd(next, 'me')?.key).not.toBe(detectMatchEnd(state, 'me')?.key);
    });

    it('checks the match end before Hunger and Gun Game', () => {
        const state = stateWith({ matchEndsAt: 5000, hungerRoundEndsAt: 8000, gunGameWinnerId: 'me' });
        expect(detectMatchEnd(state, 'me')?.key).toBe('match:5000');
    });
});
