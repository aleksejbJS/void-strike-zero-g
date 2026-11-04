import { describe, it, expect } from 'vitest';
import { GameMode } from '../../types';
import { MODE_INFO, MODE_ORDER } from './modeInfo';

describe('mode info', () => {
    it('describes every game mode in English and Russian', () => {
        for (const language of ['en', 'ru'] as const) {
            for (const mode of Object.values(GameMode)) {
                expect(MODE_INFO[language][mode]?.name, `${mode} (${language})`).toBeTruthy();
            }
        }
    });

    it('does not offer the tournament-only duel in the mode list', () => {
        expect(MODE_ORDER).not.toContain(GameMode.DUEL);
        expect(MODE_ORDER).toHaveLength(Object.values(GameMode).length - 1);
    });
});
