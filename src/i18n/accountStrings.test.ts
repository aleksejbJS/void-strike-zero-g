import { describe, it, expect } from 'vitest';
import { accountStrings } from './accountStrings';

const placeholders = (text: string) => (text.match(/\{\d+\}/g) ?? []).sort().join();

describe('accountStrings', () => {
    it('has every key in English and Russian, non-empty, with the same placeholders', () => {
        const en = Object.entries(accountStrings.en);
        expect(en.length).toBeGreaterThan(20);
        expect(Object.keys(accountStrings.ru).sort()).toEqual(Object.keys(accountStrings.en).sort());
        for (const [key, text] of en) {
            const ru = accountStrings.ru[key as keyof typeof accountStrings.ru];
            expect(text, key).not.toBe('');
            expect(ru, key).not.toBe('');
            expect(placeholders(ru), key).toBe(placeholders(text));
        }
    });
});
