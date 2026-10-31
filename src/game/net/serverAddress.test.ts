import { describe, it, expect } from 'vitest';
import { resolveServerUrl } from './serverAddress';

describe('resolveServerUrl', () => {
    it.each([
        [null, 'http://game.local:3001'],
        ['', 'http://game.local:3001'],
        ['192.168.1.5', 'http://192.168.1.5:3001'],
        ['192.168.1.5:4000', 'http://192.168.1.5:4000'],
        ['  myhost  ', 'http://myhost:3001'],
        ['https://abc.loca.lt/', 'https://abc.loca.lt'],
        ['http://example.com:8080', 'http://example.com:8080'],
    ])('%j → %s', (input, expected) => {
        expect(resolveServerUrl(input, 'game.local')).toBe(expected);
    });
});

import { parseJoinTarget, inviteLink, inviteHostId } from './serverAddress';

describe('parseJoinTarget', () => {
    it('recognises invite links and stored peer ids', () => {
        expect(parseJoinTarget('https://void.example/?host=abc-123', 'x')).toEqual({ kind: 'peer', peerId: 'abc-123' });
        expect(parseJoinTarget('peer:abc-123', 'x')).toEqual({ kind: 'peer', peerId: 'abc-123' });
    });

    it('treats anything else as a server address', () => {
        expect(parseJoinTarget('192.168.1.5', 'x')).toEqual({ kind: 'server', url: 'http://192.168.1.5:3001' });
    });

    it('builds invite links that parse back to the same host', () => {
        const link = inviteLink('id with space', { origin: 'https://void.example', pathname: '/play' });
        expect(link).toBe('https://void.example/play?host=id%20with%20space');
        expect(inviteHostId(link)).toBe('id with space');
    });
});
