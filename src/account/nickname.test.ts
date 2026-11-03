import { describe, it, expect } from 'vitest';
import {
    NICK_MIN, NICK_MAX, GUEST_DEFAULT_NAME,
    normalizeNickname, nicknameKey, validateNickname, nicknameToEmail,
} from './nickname';

describe('nickname limits', () => {
    it('exposes the length bounds and the guest default', () => {
        expect(NICK_MIN).toBe(3);
        expect(NICK_MAX).toBe(12);
        expect(GUEST_DEFAULT_NAME).toBe('Anonymous');
    });
});

describe('normalizeNickname', () => {
    it('trims and collapses inner whitespace runs to one space', () => {
        expect(normalizeNickname('  Big   Al ')).toBe('Big Al');
        expect(normalizeNickname('Big\t\n Al')).toBe('Big Al');
    });
});

describe('nicknameKey', () => {
    it('is the normalized name lower-cased', () => {
        expect(nicknameKey('  BIG   Al ')).toBe('big al');
        expect(nicknameKey('ЁЖИК')).toBe('ёжик');
    });
});

describe('validateNickname', () => {
    it('rejects names that are too short or too long', () => {
        expect(validateNickname('Al')).toBe('too_short');
        expect(validateNickname('   ')).toBe('too_short');
        expect(validateNickname('A'.repeat(13))).toBe('too_long');
    });

    it('measures length after trimming and collapsing spaces', () => {
        expect(validateNickname('  Al  ')).toBe('too_short');
        expect(validateNickname(`  ${'A'.repeat(12)}  `)).toBeNull();
        expect(validateNickname('A'.repeat(12))).toBeNull();
        expect(validateNickname('A'.repeat(3))).toBeNull();
    });

    it('rejects characters outside letters, digits, underscore, hyphen and space', () => {
        expect(validateNickname('Alex!')).toBe('bad_chars');
        expect(validateNickname('Al.ex')).toBe('bad_chars');
        expect(validateNickname('Alex😀')).toBe('bad_chars');
        expect(validateNickname('日本語名前')).toBe('bad_chars');
        expect(validateNickname('Ⅻ Ⅻ Ⅻ')).toBe('bad_chars');
    });

    it('rejects Latin and Cyrillic letters mixed in one name', () => {
        expect(validateNickname('Аlex')).toBe('mixed_scripts'); // first letter is Cyrillic А
        expect(validateNickname('Alex Иван')).toBe('mixed_scripts');
    });

    it('reports bad_chars before mixed_scripts', () => {
        expect(validateNickname('Аlex!')).toBe('bad_chars'); // Cyrillic А + Latin + "!"
    });

    it('rejects names whose lower-cased key is too wide for the email local part', () => {
        expect(validateNickname('Ａ'.repeat(12))).toBe('bad_chars'); // fullwidth A, 3 bytes
        expect(validateNickname('Ꙁ'.repeat(12))).toBe('bad_chars'); // U+A640, Cyrillic Extended-B
        expect(validateNickname('Ⱥ'.repeat(12))).toBe('bad_chars'); // lower-cases to 3-byte U+2C65
        expect(validateNickname('İ'.repeat(12))).toBe('bad_chars'); // lower-cases to i + U+0307
        expect(validateNickname('\u{10780}'.repeat(12))).toBe('bad_chars'); // 4-byte Latin letter
    });

    it('rejects names whose lower-casing leaves a combining mark (JS and the database would disagree)', () => {
        expect(validateNickname('İzmir')).toBe('bad_chars'); // İ lower-cases to i + U+0307
        expect(validateNickname('Ёжик')).toBeNull();
        expect(validateNickname('Alex_99')).toBeNull();
    });

    it('allows the longest Cyrillic name and stops exactly past 31 key bytes', () => {
        expect(validateNickname('Ё'.repeat(12))).toBeNull(); // 24 bytes
        const at31 = 'Ａ'.repeat(10) + 'b'; // 10 x 3 + 1 = 31 bytes
        const at32 = 'Ａ'.repeat(10) + 'bc'; // 32 bytes
        expect(validateNickname(at31)).toBeNull();
        expect(validateNickname(at32)).toBe('bad_chars');
        expect(nicknameToEmail(at31).split('@')[0].length).toBeLessThanOrEqual(64);
    });

    it('reserves Anonymous and Bot <n> in any case', () => {
        expect(validateNickname('anonymous')).toBe('reserved');
        expect(validateNickname(' ANONYMOUS ')).toBe('reserved');
        expect(validateNickname('Bot 3')).toBe('reserved');
        expect(validateNickname('bot  12')).toBe('reserved');
    });

    it('does not reserve names that only look similar', () => {
        expect(validateNickname('Bot')).toBeNull();
        expect(validateNickname('Bot 3x')).toBeNull();
        expect(validateNickname('Botman')).toBeNull();
    });

    it('accepts valid names', () => {
        expect(validateNickname('Алексей')).toBeNull();
        expect(validateNickname('Alex_99')).toBeNull();
        expect(validateNickname('Big  Al')).toBeNull();
        expect(validateNickname('x-ray 7')).toBeNull();
        expect(validateNickname('Élan')).toBeNull();
        expect(validateNickname('123')).toBeNull();
    });
});

describe('nicknameToEmail', () => {
    it('gives the same address for names that differ only by case and spaces', () => {
        expect(nicknameToEmail('ALEX')).toBe(nicknameToEmail(' alex '));
        expect(nicknameToEmail('Big   Al')).toBe(nicknameToEmail('big al'));
    });

    it('gives different addresses for different names', () => {
        expect(nicknameToEmail('alex')).not.toBe(nicknameToEmail('alexa'));
    });

    it('hex-encodes the UTF-8 key behind an "n" prefix', () => {
        expect(nicknameToEmail('Ab')).toBe('n6162@players.invalid');
        expect(nicknameToEmail('Ё')).toBe('nd191@players.invalid'); // ё = U+0451 = d1 91
    });

    it('keeps the local part within 64 chars for the longest Cyrillic name', () => {
        const email = nicknameToEmail('Ё'.repeat(12));
        expect(email).toMatch(/^n[0-9a-f]+@players\.invalid$/);
        expect(email.split('@')[0].length).toBeLessThanOrEqual(64);
    });
});
