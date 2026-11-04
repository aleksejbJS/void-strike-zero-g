import { describe, it, expect } from 'vitest';
import { tournamentStrings } from './tournamentStrings';
import { translations } from './locales';

const placeholders = (text: string) => (text.match(/\{\d+\}/g) ?? []).sort().join();

describe('tournamentStrings', () => {
    it('has every key in English and Russian, non-empty, with the same placeholders', () => {
        const en = Object.entries(tournamentStrings.en);
        expect(en.length).toBeGreaterThan(20);
        expect(Object.keys(tournamentStrings.ru).sort()).toEqual(Object.keys(tournamentStrings.en).sort());
        for (const [key, text] of en) {
            const ru = tournamentStrings.ru[key as keyof typeof tournamentStrings.ru];
            expect(text, key).not.toBe('');
            expect(ru, key).not.toBe('');
            expect(placeholders(ru), key).toBe(placeholders(text));
        }
    });

    it('has a message for every error code', () => {
        for (const code of ['not_open', 'full', 'not_creator', 'not_enough_players', 'bad_ticket', 'offline', 'unknown']) {
            expect(tournamentStrings.en, code).toHaveProperty(`tournament.error.${code}`);
        }
    });

    it('is merged into the main translation table', () => {
        expect(translations.en['tournament.menu']).toBe('Tournaments');
        expect(translations.ru['tournament.menu']).toBe('Турниры');
    });
});
