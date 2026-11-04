// The host's match results, kept until the server takes them (module level, like runHistory: it outlives
// the duel screen). The duel queues its result; the tournament autopilot retries every few seconds, so one
// slow or failed request never leaves a played match to the stale rules. A report the server rejects for
// good (bad_ticket, bad_score) is logged and dropped. report_result is a no-op on a match that is already
// decided, so a success always means the match is settled.

import { reportResult } from '../../../tournament/tournamentApi';
import { TournamentError, type SeatTicket } from '../../../tournament/types';

export interface PendingReport {
    matchId: string;
    ticket: SeatTicket;
    scoreA: number;
    scoreB: number;
}

export type ReportOutcome = { kind: 'sent' } | { kind: 'failed' | 'dropped'; error: unknown };

const pending = new Map<string, PendingReport>();
const inFlight = new Map<string, Promise<ReportOutcome>>();

const isFinal = (error: unknown): boolean =>
    error instanceof TournamentError && (error.code === 'bad_ticket' || error.message === 'bad_score');

const attempt = (matchId: string): Promise<ReportOutcome> => {
    const running = inFlight.get(matchId);
    if (running) return running;
    const report = pending.get(matchId);
    if (!report) return Promise.resolve({ kind: 'sent' });
    const sending = reportResult(report.matchId, report.ticket, report.scoreA, report.scoreB).then(
        (): ReportOutcome => {
            pending.delete(matchId);
            return { kind: 'sent' };
        },
        (error: unknown): ReportOutcome => {
            if (isFinal(error)) {
                console.error(`[tournament] the server refused the result of match ${matchId}, dropping it`, error);
                pending.delete(matchId);
                return { kind: 'dropped', error };
            }
            console.warn(`[tournament] reporting match ${matchId} failed, it stays queued`, error);
            return { kind: 'failed', error };
        },
    ).finally(() => inFlight.delete(matchId));
    inFlight.set(matchId, sending);
    return sending;
};

/** Queues the result and sends it right away; the outcome of that first attempt. */
export const queueReport = (report: PendingReport): Promise<ReportOutcome> => {
    pending.set(report.matchId, report);
    return attempt(report.matchId);
};

/** Sends every queued result again (one request per match at a time). */
export const retryReports = async (): Promise<void> => {
    await Promise.all([...pending.keys()].map(attempt));
};

export const pendingReports = (): PendingReport[] => [...pending.values()];

/** Test helper: a fresh page session. */
export const forgetReports = (): void => {
    pending.clear();
    inFlight.clear();
};
