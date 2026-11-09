import { describe, it, expect } from 'vitest';
import { leaderboardStrings } from './leaderboardStrings';
import { translations } from './locales';

const placeholders = (text: string) => (text.match(/\{\d+\}/g) ?? []).sort().join();

describe('leaderboardStrings', () => {
    it('has every key in English and Russian, non-empty, with the same placeholders', () => {
        const en = Object.entries(leaderboardStrings.en);
        expect(Object.keys(leaderboardStrings.ru).sort()).toEqual(Object.keys(leaderboardStrings.en).sort());
        for (const [key, text] of en) {
            const ru = leaderboardStrings.ru[key as keyof typeof leaderboardStrings.ru];
            expect(text, key).not.toBe('');
            expect(ru, key).not.toBe('');
            expect(placeholders(ru), key).toBe(placeholders(text));
        }
    });

    it('is merged into the main translation table', () => {
        expect(translations.en['lb.title']).toBe('Top players');
        expect(translations.ru['lb.title']).toBe('Топ игроков');
    });
});
