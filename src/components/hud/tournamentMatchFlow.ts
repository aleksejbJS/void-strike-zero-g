// The automatic part of a tournament duel, without React: heartbeats, the host's peer id and result, back to
// the bracket after the end screen, and giving up on an opponent or host that vanished.
// useTournamentMatch drives it with a clock tick and the connection's signals.

import type { GameState } from '../../types';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { matchSeen, publishHost, reportResult, resolveStale } from '../../tournament/tournamentApi';

export const HEARTBEAT_MS = 10_000; // matchSeen while connected (resolve_stale counts 60 s of silence)
export const BACK_TO_BRACKET_MS = 8_000; // after the end screen appears
export const OPPONENT_GONE_MS = 60_000; // the spec's no-show / disconnect timeout
export const HOST_SILENT_MS = 5_000; // PeerJS never reports a vanished host: no snapshot this long means gone
const RETRY_MS = 5_000; // a failed publish or report is tried again while the duel is open

export interface MatchFlowDeps {
    run: TournamentMatchRun;
    read: () => { state: GameState; localId: string };
    /** Back to the bracket (endTournamentMatch). */
    end: () => void;
    /** A tournament call failed: log it and show it. */
    fail: (what: string, error: unknown) => void;
    /** A tournament call went through: the shown error, if any, is over. */
    ok: () => void;
}

export class TournamentMatchFlow {
    private connectedAt: number | null; // the host plays from the start, the guest once joined
    private lastBeatAt = -Infinity;
    private lastSnapshotAt = 0;
    private endSeenAt: number | null = null;
    private missingSince: number | null = null;
    private finished = false;
    private disposed = false;
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();

    constructor(private readonly deps: MatchFlowDeps, now: number) {
        this.connectedAt = deps.run.role === 'host' ? now : null;
    }

    /** Called a few times a second. */
    tick(now: number): void {
        if (this.finished || this.connectedAt === null) return;
        if (now - this.lastBeatAt >= HEARTBEAT_MS) {
            this.lastBeatAt = now;
            this.call('matchSeen', () => matchSeen(this.deps.run.matchId, this.deps.run.ticket));
        }
        const { state, localId } = this.deps.read();
        if (state.matchEndsAt) {
            if (this.endSeenAt === null) {
                this.endSeenAt = now;
                if (this.deps.run.role === 'host') this.report(state, localId);
            } else if (now - this.endSeenAt >= BACK_TO_BRACKET_MS) {
                this.finish();
            }
            return; // decided: nobody needs to wait for anyone any more
        }
        if (this.deps.run.role === 'guest' && now - this.lastSnapshotAt >= HOST_SILENT_MS) {
            console.warn('[tournament] no snapshot from the host for 5 s, treating it as gone');
            this.finish(); // the bracket's resolveStale loop settles the match
            return;
        }
        this.watchOpponent(state, localId, now);
    }

    /** Host: the room is reachable at this PeerJS id. */
    inviteReady(peerId: string): void {
        const publish = () => this.call('publishHost', () => publishHost(this.deps.run.matchId, this.deps.run.ticket, peerId), publish);
        publish();
    }

    /** The room accepted us. */
    joined(now: number): void {
        this.connectedAt ??= now;
        this.lastSnapshotAt = now;
    }

    snapshot(now: number): void {
        this.lastSnapshotAt = now;
    }

    /** The link to the room closed (the host left or the network dropped). */
    disconnected(): void {
        this.finish();
    }

    dispose(): void {
        this.disposed = true;
        this.timers.forEach(clearTimeout);
        this.timers.clear();
    }

    private watchOpponent(state: GameState, localId: string, now: number): void {
        if (state.players.some(p => p.id !== localId)) {
            this.missingSince = null;
            return;
        }
        this.missingSince ??= now;
        if (now - this.missingSince < OPPONENT_GONE_MS) return;
        console.warn('[tournament] the opponent has been gone for 60 s, asking the server to settle the match');
        this.finished = true;
        resolveStale(this.deps.run.ticket.tournamentId)
            .catch((error: unknown) => this.deps.fail('resolveStale', error))
            .finally(() => this.deps.end());
    }

    /** scoreA belongs to the match's seat A: mine when I sit there, the opponent's otherwise. */
    private report(state: GameState, localId: string): void {
        const mine = state.players.find(p => p.id === localId)?.score ?? 0;
        const theirs = state.players.find(p => p.id !== localId)?.score ?? 0;
        const [scoreA, scoreB] = this.deps.run.side === 'a' ? [mine, theirs] : [theirs, mine];
        const send = () => this.call('reportResult', () => reportResult(this.deps.run.matchId, this.deps.run.ticket, scoreA, scoreB), send);
        send();
    }

    private finish(): void {
        if (this.finished) return;
        this.finished = true;
        this.deps.end();
    }

    /** Runs one API call; a failure is shown and, with `retry`, tried again in a few seconds. */
    private call(what: string, request: () => Promise<void>, retry?: () => void): void {
        request().then(
            () => { if (!this.disposed) this.deps.ok(); },
            (error: unknown) => {
                if (this.disposed) {
                    console.warn(`[tournament] ${what} failed after the duel closed`, error);
                    return;
                }
                this.deps.fail(what, error);
                if (!retry) return;
                const timer = setTimeout(() => { this.timers.delete(timer); retry(); }, RETRY_MS);
                this.timers.add(timer);
            },
        );
    }
}
