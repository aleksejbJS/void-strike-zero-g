// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode } from '../../src/types';
import { loadConfig } from './config';

afterEach(() => { vi.unstubAllEnvs(); });

describe('loadConfig SERVER_MODE', () => {
    it('accepts the public modes', () => {
        vi.stubEnv('SERVER_MODE', 'ctf');
        expect(loadConfig().mode).toBe(GameMode.CTF);
    });

    it('refuses DUEL, which only tournaments host, and falls back to Deathmatch', () => {
        vi.stubEnv('SERVER_MODE', 'DUEL');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(loadConfig().mode).toBe(GameMode.DEATHMATCH);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});
