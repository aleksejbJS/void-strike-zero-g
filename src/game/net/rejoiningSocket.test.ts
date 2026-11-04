import { describe, it, expect, vi } from 'vitest';
import { EmitterSocket } from './sessionSocket';
import { MSG } from './protocol';
import { RejoiningSocket } from './rejoiningSocket';

class FakeLink extends EmitterSocket {
    sent: [string, unknown][] = [];
    closed = false;
    emit(event: string, data?: unknown) { this.sent.push([event, data]); }
    disconnect() { this.closed = true; }
    fire(event: string, data?: unknown) { this.dispatch(event, data); }
}

const setup = () => {
    const links: FakeLink[] = [];
    const onAttemptFailed = vi.fn();
    const socket = new RejoiningSocket(() => { const l = new FakeLink(); links.push(l); return l; }, onAttemptFailed);
    const got: string[] = [];
    for (const event of ['connect', 'disconnect', 'connect_error', MSG.JOINED, MSG.JOIN_REJECTED, MSG.SNAPSHOT]) {
        socket.on(event, () => got.push(event));
    }
    return { socket, links, onAttemptFailed, got };
};

describe('RejoiningSocket', () => {
    it('behaves like its link until a rejoin', () => {
        const { socket, links, got } = setup();
        links[0].fire('connect');
        links[0].fire(MSG.SNAPSHOT);
        socket.emit(MSG.INPUT, 1);
        links[0].fire('disconnect');
        expect(got).toEqual(['connect', MSG.SNAPSHOT, 'disconnect']);
        expect(links[0].sent).toEqual([[MSG.INPUT, 1]]);
    });

    it('rejoin closes the old link and dials a new one under the same handlers', () => {
        const { socket, links, got } = setup();
        socket.rejoin();
        expect(links).toHaveLength(2);
        expect(links[0].closed).toBe(true);
        links[0].fire(MSG.SNAPSHOT); // the old link is deaf now
        links[1].fire('connect'); // ClientSession sends JOIN again on this
        links[1].fire(MSG.JOINED);
        links[1].fire(MSG.SNAPSHOT);
        socket.emit(MSG.INPUT, 2);
        expect(got).toEqual(['connect', MSG.JOINED, MSG.SNAPSHOT]);
        expect(links[1].sent).toEqual([[MSG.INPUT, 2]]);
    });

    it('while dialling, a failed attempt goes to onAttemptFailed, not to the session', () => {
        const { socket, links, onAttemptFailed, got } = setup();
        socket.rejoin();
        links[1].fire('connect_error', new Error('peer-unavailable'));
        socket.rejoin();
        links[2].fire(MSG.JOIN_REJECTED, { reason: 'full' }); // the old entity is still in the room
        socket.rejoin();
        links[3].fire('disconnect');
        expect(onAttemptFailed).toHaveBeenCalledTimes(3);
        expect(got).toEqual([]);
    });

    it('once back in, a lost link reaches the session again', () => {
        const { socket, links, onAttemptFailed, got } = setup();
        socket.rejoin();
        links[1].fire(MSG.JOINED);
        links[1].fire('disconnect');
        expect(got).toEqual([MSG.JOINED, 'disconnect']);
        expect(onAttemptFailed).not.toHaveBeenCalled();
    });

    it('disconnect and removeAllListeners act on the current link', () => {
        const { socket, links, got } = setup();
        socket.rejoin();
        socket.removeAllListeners();
        links[1].fire(MSG.SNAPSHOT);
        socket.disconnect();
        expect(got).toEqual([]);
        expect(links[1].closed).toBe(true);
    });
});
