// The host's results outlive the duel screen: queued, then retried until the server takes them.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportResult } from '../../../tournament/tournamentApi';
import { TournamentError } from '../../../tournament/types';
import { forgetReports, pendingReports, queueReport, retryReports } from './reportOutbox';

vi.mock('../../../tournament/tournamentApi', () => ({ reportResult: vi.fn() }));

const ticket = { tournamentId: 't1', seat: 0, secret: 's' };
const report = { matchId: 'm1', ticket, scoreA: 10, scoreB: 7 };

beforeEach(() => {
    forgetReports();
    vi.mocked(reportResult).mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('reportOutbox', () => {
    it('a report the server takes leaves the outbox', async () => {
        vi.mocked(reportResult).mockResolvedValue(undefined);
        expect(await queueReport(report)).toEqual({ kind: 'sent' });
        expect(reportResult).toHaveBeenCalledWith('m1', ticket, 10, 7);
        expect(pendingReports()).toEqual([]);
    });

    it('a failed report stays queued and a later retry sends it', async () => {
        vi.mocked(reportResult).mockRejectedValueOnce(new TournamentError('unknown', 'Failed to fetch')).mockResolvedValue(undefined);
        const first = await queueReport(report);
        expect(first.kind).toBe('failed');
        expect(pendingReports()).toEqual([report]);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(TournamentError));
        await retryReports();
        expect(reportResult).toHaveBeenCalledTimes(2);
        expect(pendingReports()).toEqual([]);
    });

    it('drops a report the server rejects for good: bad_ticket or bad_score', async () => {
        vi.mocked(reportResult).mockRejectedValueOnce(new TournamentError('bad_ticket'));
        expect((await queueReport(report)).kind).toBe('dropped');
        vi.mocked(reportResult).mockRejectedValueOnce(new TournamentError('unknown', 'bad_score'));
        expect((await queueReport({ ...report, matchId: 'm2' })).kind).toBe('dropped');
        expect(pendingReports()).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(TournamentError));
    });

    it('never sends the same report twice at once', async () => {
        let answer!: () => void;
        vi.mocked(reportResult).mockReturnValue(new Promise<void>(resolve => { answer = resolve; }));
        const first = queueReport(report);
        const retry = retryReports();
        expect(reportResult).toHaveBeenCalledTimes(1);
        answer();
        await Promise.all([first, retry]);
        expect(pendingReports()).toEqual([]);
    });
});
