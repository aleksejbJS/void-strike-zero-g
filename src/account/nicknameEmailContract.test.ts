// The sign-up trigger in the SQL migration recomputes the fake e-mail from the nickname key, so the
// database and nicknameToEmail must agree byte for byte. This pins the shared form for both scripts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { NICK_MAX, NICK_MIN, nicknameKey, nicknameToEmail, validateNickname } from './nickname';

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

const migration = (name: string): string => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');

describe('migration trigger guards (0.4.22, kept for its e-mail and spacing rules)', () => {
    const sql = migration('20261103000000_accounts.sql');

    it('derives the e-mail with the same expression and domain', () => {
        expect(sql).toContain("'n' || encode(convert_to(v_nickname_key, 'UTF8'), 'hex') || '@players.invalid'");
    });

    it('repeats the charset, spacing and look-alike rules', () => {
        expect(sql).toContain("v_nickname !~ '^[[:alnum:]_ -]+$'");
        expect(sql).toContain("v_nickname <> btrim(v_nickname) or v_nickname ~ '  '");
        expect(sql).toMatch(/v_nickname ~ '\[A-Za-z[^']*\]' and v_nickname ~ '\[\\u0400-\\u052F\]'/);
    });

    it('enforces the length, case and reserved-name rules', () => {
        expect(sql).toContain(`char_length(v_nickname) not between ${NICK_MIN} and ${NICK_MAX}`);
        expect(sql).toContain('lower(v_nickname) <> v_nickname_key');
        expect(sql).toContain("v_nickname_key = 'anonymous'");
        expect(sql).toContain("v_nickname_key ~ '^bot [0-9]+$'");
    });
});

describe('account hardening migration (0.4.26)', () => {
    const sql = migration('20261105000000_account_hardening.sql');
    const WHITELIST = /v_nickname !~ '\^\[([^\]]+)\]\+\$'/;

    it('replaces the sign-up function and keeps the e-mail, spacing, length, case and reserved rules', () => {
        expect(sql).toContain('create or replace function public.handle_new_user()');
        expect(sql).toContain("'n' || encode(convert_to(v_nickname_key, 'UTF8'), 'hex') || '@players.invalid'");
        expect(sql).toContain("v_nickname <> btrim(v_nickname) or v_nickname ~ '  '");
        expect(sql).toContain(`char_length(v_nickname) not between ${NICK_MIN} and ${NICK_MAX}`);
        expect(sql).toContain('lower(v_nickname) <> v_nickname_key');
        expect(sql).toContain("v_nickname_key = 'anonymous'");
        expect(sql).toContain("v_nickname_key ~ '^bot [0-9]+$'");
        expect(sql).not.toContain('[[:alnum:]');
    });

    it('accepts exactly the characters the browser accepts for a new nickname', () => {
        const match = WHITELIST.exec(sql);
        expect(match).not.toBeNull();
        // The SQL class, read as a JS character class (both use \uXXXX code points and a trailing '-').
        const sqlChar = new RegExp(`^[${match![1]}]$`);
        const browserChar = (ch: string): boolean => validateNickname(`Abc${ch}`) === null || validateNickname(`Абв${ch}`) === null;
        const samples = [...'azAZ09_- ЁёАЯаяжЖ', 'É', 'é', 'Ａ', 'ᴀ', 'Α', 'α', 'Ї', 'і', '\u200B', '!', '.', 'Ꙁ', 'ß'];
        for (const ch of samples) expect(sqlChar.test(ch), `"${ch}"`).toBe(browserChar(ch));
    });

    it('still forbids mixing Latin and Cyrillic letters', () => {
        expect(sql).toContain(String.raw`v_nickname ~ '[A-Za-z]' and v_nickname ~ '[\u0410-\u044F\u0401\u0451]'`);
    });

    it('locks the e-mail of every account with a before-update trigger', () => {
        expect(sql).toContain('create or replace function public.prevent_email_change()');
        expect(sql).toContain('new.email is distinct from old.email');
        expect(sql).toMatch(/before update of email on auth\.users\s+for each row execute function public\.prevent_email_change\(\)/);
        expect(sql).toContain('revoke all on function public.prevent_email_change() from public, anon, authenticated;');
        const fn = sql.slice(sql.indexOf('create or replace function public.prevent_email_change()'));
        expect(fn).toMatch(/security definer\s+set search_path = public/);
    });
});
