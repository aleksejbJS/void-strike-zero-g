// The automatic part of a tournament duel, without React: heartbeats, the host's peer id and result, back to
// the bracket after the end screen, Esc-Esc to forfeit, getting a guest back in after a dropped link, and
// giving up on an opponent or host that vanished. useTournamentMatch drives it with a clock tick and the
// connection's signals.

import type { GameState } from '../../types';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { matchSeen, publishHost, resolveStale } from '../../tournament/tournamentApi';
import { markForfeit, markNoShow } from '../tournament/autopilot/runHistory';
import { queueReport } from '../tournament/autopilot/reportOutbox';
import { GuestRejoin } from './guestRejoin';
import { duelScores, opponentOf } from './duelScores';
import { FlowCalls, type FlowCallHooks } from './flowCalls';

export const HEARTBEAT_MS = 10_000; // matchSeen while connected (resolve_stale counts 60 s of silence)
export const BACK_TO_BRACKET_MS = 8_000; // after the end screen appears
export const OPPONENT_GONE_MS = 60_000; // the spec's no-show / disconnect timeout
export const HOST_SILENT_MS = 5_000; // PeerJS never reports a vanished host: no snapshot this long means a lost link
export const GUEST_JOIN_MS = 50_000; // a guest that cannot join the host by then counts as a no-show
export const FORFEIT_CONFIRM_MS = 2_000; // the second Esc must come this soon to forfeit

/** fail / ok (FlowCallHooks): a tournament call failed (log and show it) / went through (the error is over). */
export interface MatchFlowDeps extends FlowCallHooks {
    run: TournamentMatchRun;
    read: () => { state: GameState; localId: string };
    /** Back to the bracket (endTournamentMatch). */
    end: () => void;
    /** Guest: drop the link to the host and dial it again. */
    rejoin: () => void;
}

export class TournamentMatchFlow {
    private connectedAt: number | null; // the host plays from the start, the guest once joined
    private readonly joinDeadline: number; // guest only: a no-show when not joined by then
    private readonly rejoining: GuestRejoin;
    private lastBeatAt = -Infinity;
    private lastSnapshotAt = 0;
    private endSeenAt: number | null = null;
    private missingSince: number | null = null;
    private forfeitArmedAt: number | null = null;
    private finished = false;
    private readonly calls: FlowCalls;

    constructor(private readonly deps: MatchFlowDeps, now: number) {
        this.connectedAt = deps.run.role === 'host' ? now : null;
        this.joinDeadline = now + GUEST_JOIN_MS;
        this.rejoining = new GuestRejoin(() => deps.rejoin());
        this.calls = new FlowCalls(deps); // a failed publish or report is tried again while the duel is open
    }

    /** Whole seconds until the end screen goes back to the bracket (the full delay until the end is seen). */
    backInSec(now: number): number {
        const left = this.endSeenAt === null ? BACK_TO_BRACKET_MS : BACK_TO_BRACKET_MS - (now - this.endSeenAt);
        return Math.max(0, Math.ceil(left / 1000));
    }

    /** "Press Esc again to forfeit" is showing. */
    forfeitArmed(now: number): boolean {
        return !this.finished && this.forfeitArmedAt !== null && now - this.forfeitArmedAt < FORFEIT_CONFIRM_MS;
    }

    /** Guest: the link dropped mid-duel and it is dialling the host again. */
    get reconnecting(): boolean {
        return !this.finished && this.connectedAt !== null && this.rejoining.active;
    }

    /** Called a few times a second. */
    tick(now: number): void {
        if (this.finished) return;
        if (this.connectedAt === null) {
            if (now >= this.joinDeadline) this.noShow(`could not join the host within ${GUEST_JOIN_MS / 1000} s`);
            else this.rejoining.tick(now); // a refused first join is dialled again
            return;
        }
        if (now - this.lastBeatAt >= HEARTBEAT_MS) {
            this.lastBeatAt = now;
            this.calls.run('matchSeen', () => matchSeen(this.deps.run.matchId, this.deps.run.ticket));
        }
        if (this.rejoining.active) {
            if (this.rejoining.tick(now) === 'gave-up') this.noShow('could not get back into the duel within 60 s');
            return;
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
            console.warn('[tournament] no snapshot from the host for 5 s, reconnecting');
            this.rejoining.start(now);
            return;
        }
        this.watchOpponent(state, localId, now);
    }

    /** Esc. Before the end: the first press arms, a second one within 2 s forfeits. After it: back to the bracket. */
    escape(now: number): void {
        if (this.finished) return;
        if (this.endSeenAt !== null || this.deps.read().state.matchEndsAt) {
            this.finish();
        } else if (this.forfeitArmed(now)) {
            // No heartbeat for this match from now on: the stale rule gives the opponent the win
            console.warn('[tournament] forfeiting the duel');
            markForfeit(this.deps.run.matchId);
            this.finish();
        } else {
            this.forfeitArmedAt = now;
        }
    }

    /** Host: the room is reachable at this PeerJS id. */
    inviteReady(peerId: string): void {
        const publish = () => this.calls.run('publishHost', () => publishHost(this.deps.run.matchId, this.deps.run.ticket, peerId), publish);
        publish();
    }

    /** The room accepted us (first join, or back in after a dropped link). */
    joined(now: number): void {
        this.connectedAt ??= now;
        this.lastSnapshotAt = now;
        this.rejoining.done();
    }

    snapshot(now: number): void {
        this.lastSnapshotAt = now;
    }

    /** First join refused as full: our old link (before a reload) holds the seat until the host drops it. */
    rejected(now: number): void {
        if (this.finished || this.connectedAt !== null) return;
        console.warn('[tournament] the host says the duel is full, dialling again');
        this.rejoining.start(now);
    }

    /** The link to the room closed (the host left or the network dropped), or a reconnect attempt failed. */
    disconnected(now: number): void {
        if (this.finished) return;
        if (this.rejoining.active) {
            this.rejoining.failed(now);
        } else if (this.connectedAt === null) {
            this.noShow('lost the link to the host before joining');
        } else if (this.endSeenAt !== null || this.deps.read().state.matchEndsAt) {
            this.finish(); // decided already
        } else {
            console.warn('[tournament] lost the link to the host, reconnecting');
            this.rejoining.start(now);
        }
    }

    dispose(): void {
        this.calls.dispose();
    }

    private watchOpponent(state: GameState, localId: string, now: number): void {
        if (opponentOf(state, localId)) {
            this.missingSince = null;
            return;
        }
        this.missingSince ??= now;
        if (now - this.missingSince < OPPONENT_GONE_MS) return;
        console.warn('[tournament] the opponent has been gone for 60 s, asking the server to settle the match');
        this.finished = true;
        resolveStale(this.deps.run.ticket.tournamentId)
            .catch((error: unknown) => this.deps.fail('resolveStale', error))
            .finally(() => { if (!this.calls.disposed) this.deps.end(); });
    }

    /** Via the outbox, which outlives this duel: the autopilot keeps retrying it back on the bracket. */
    private report(state: GameState, localId: string): void {
        const { matchId, ticket, side } = this.deps.run;
        const scores = duelScores(state, localId, side);
        let refused = false; // bad_ticket / bad_score: retrying cannot help
        const send = () => this.calls.run('reportResult', async () => {
            const outcome = await queueReport({ matchId, ticket, ...scores });
            if (outcome.kind === 'sent') return;
            refused = outcome.kind === 'dropped';
            throw outcome.error;
        }, () => { if (!refused) send(); });
        send();
    }

    /** A guest that never got in, or could not get back in: absent for this host peer id, so the host wins. */
    private noShow(why: string): void {
        console.warn(`[tournament] ${why}, going back to the bracket`);
        if (this.deps.run.peerId) markNoShow(this.deps.run.matchId, this.deps.run.peerId);
        this.finish();
    }

    private finish(): void {
        if (this.finished) return;
        this.finished = true;
        this.deps.end();
    }
}
