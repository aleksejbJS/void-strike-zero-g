import { describe, it, expect, vi } from 'vitest';
import { PeerSocket, describePeerError } from './peerSocket';

// Minimal stand-ins for PeerJS objects: record handlers, let the test fire them
class FakeEmitter {
    handlers: Record<string, ((arg?: any) => void)[]> = {};
    on(event: string, h: (arg?: any) => void) { (this.handlers[event] ??= []).push(h); return this; }
    fire(event: string, arg?: unknown) { this.handlers[event]?.forEach(h => h(arg)); }
}
class FakeConn extends FakeEmitter { open = false; send = vi.fn(); close = vi.fn(); }
class FakePeer extends FakeEmitter { conn = new FakeConn(); connect = vi.fn(() => this.conn); destroy = vi.fn(); }

describe('PeerSocket', () => {
    it('behaves like a socket over a PeerJS data connection', () => {
        const peer = new FakePeer();
        const socket = new PeerSocket('host-1', () => peer as any);
        const got: unknown[] = [];
        socket.on('connect', () => got.push('connect'));
        socket.on('snapshot', d => got.push(d));
        socket.on('disconnect', () => got.push('disconnect'));

        peer.fire('open', 'me');
        expect(peer.connect).toHaveBeenCalledWith('host-1', { reliable: true, serialization: 'json' });
        peer.conn.open = true;
        peer.conn.fire('open');
        peer.conn.fire('data', { event: 'snapshot', data: { n: 1 } });
        peer.conn.fire('data', 'garbage');
        socket.emit('input', { a: 1 });
        peer.conn.fire('close');

        expect(got).toEqual(['connect', { n: 1 }, 'disconnect']);
        expect(peer.conn.send).toHaveBeenCalledWith({ event: 'input', data: { a: 1 } });
    });

    it('reports a friendly reason when the game does not exist', () => {
        const peer = new FakePeer();
        const socket = new PeerSocket('gone', () => peer as any);
        const errors: Error[] = [];
        socket.on('connect_error', e => errors.push(e));
        peer.fire('error', { type: 'peer-unavailable', message: 'Could not connect to peer gone' });
        expect(errors[0].message).toBe(describePeerError({ type: 'peer-unavailable' }));
    });
});
