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
