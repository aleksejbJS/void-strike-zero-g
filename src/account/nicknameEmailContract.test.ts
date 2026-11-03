// The sign-up trigger in the SQL migration recomputes the fake e-mail from the nickname key, so the
// database and nicknameToEmail must agree byte for byte. This pins the shared form for both scripts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { NICK_MAX, NICK_MIN, nicknameKey, nicknameToEmail } from './nickname';

// What the trigger computes: 'n' || encode(convert_to(key, 'UTF8'), 'hex') || '@players.invalid'
const sqlForm = (nick: string): string => `n${Buffer.from(nicknameKey(nick), 'utf8').toString('hex')}@players.invalid`;

describe('nicknameToEmail matches the database trigger form', () => {
    it('Latin: Alex -> n616c6578', () => {
        expect(nicknameToEmail('Alex')).toBe('n616c6578@players.invalid');
        expect(nicknameToEmail('Alex')).toBe(sqlForm('Alex'));
    });

    it('Cyrillic: Тест -> n + utf-8 hex of "тест"', () => {
        expect(nicknameToEmail('Тест')).toBe('nd182d0b5d181d182@players.invalid');
        expect(nicknameToEmail('Тест')).toBe(sqlForm('Тест'));
    });

    it('uses the lower-cased, trimmed key, with single inner spaces', () => {
        expect(nicknameToEmail('  Big   Al ')).toBe(sqlForm('big al'));
    });
});

describe('migration trigger guards', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261103000000_accounts.sql'), 'utf8');

    it('derives the e-mail with the same expression and domain', () => {
        expect(sql).toContain("'n' || encode(convert_to(v_nickname_key, 'UTF8'), 'hex') || '@players.invalid'");
    });

    it('enforces the length, case and reserved-name rules', () => {
        expect(sql).toContain(`char_length(v_nickname) not between ${NICK_MIN} and ${NICK_MAX}`);
        expect(sql).toContain('lower(v_nickname) <> v_nickname_key');
        expect(sql).toContain("v_nickname_key = 'anonymous'");
        expect(sql).toContain("v_nickname_key ~ '^bot [0-9]+$'");
    });
});
