import { describe, it, expect, afterEach, vi } from 'vitest';
import { MSG } from './protocol';
import { setup, watching } from './spectatorTestKit';

afterEach(() => { vi.restoreAllMocks(); });

describe('SpectatorSession: connection loss', () => {
    it('reports a disconnect after watching started', () => {
        const { socket, cb } = watching();
        socket.fire('disconnect');
        expect(cb.onEnded).toHaveBeenCalledWith('disconnected');
    });

    it('reports a link that closes without the host ever answering, so the tile cannot hang', () => {
        const { socket, cb } = setup();
        socket.fire('connect');
        socket.fire('disconnect');
        expect(cb.onEnded).toHaveBeenCalledWith('disconnected');
    });

    it('stays quiet about the close that follows a rejection (the rejection is the news)', () => {
        const { socket, cb } = setup();
        socket.fire(MSG.JOIN_REJECTED, { reason: 'spectators_full' });
        socket.fire('disconnect');
        expect(cb.onRejected).toHaveBeenCalledTimes(1);
        expect(cb.onEnded).not.toHaveBeenCalled();
    });

    it('reports a failed connection', () => {
        const { socket, cb } = setup();
        socket.fire('connect_error', new Error('timeout'));
        expect(cb.onEnded).toHaveBeenCalledWith('connection_error');
    });

    it('reports the end only once, whatever the socket does next', () => {
        const dropped = setup();
        dropped.socket.fire('disconnect');
        dropped.socket.fire('connect_error', new Error('late'));
        dropped.socket.fire('disconnect');
        expect(dropped.cb.onEnded).toHaveBeenCalledTimes(1);
        expect(dropped.cb.onEnded).toHaveBeenCalledWith('disconnected');

        const failed = setup();
        failed.socket.fire('connect_error', new Error('refused'));
        failed.socket.fire('disconnect');
        expect(failed.cb.onEnded).toHaveBeenCalledTimes(1);
        expect(failed.cb.onEnded).toHaveBeenCalledWith('connection_error');
    });

    it('stops listening once disposed', () => {
        const { socket, cb, session } = watching();
        session.dispose();
        socket.fire('disconnect');
        expect(cb.onEnded).not.toHaveBeenCalled();
    });
});
