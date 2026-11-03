// Nickname rules (3-12 chars, one script, no look-alike names) and the nickname -> fake email
// encoding that lets Supabase email+password auth carry a nickname+password account.

export const NICK_MIN = 3;
export const NICK_MAX = 12;
export const GUEST_DEFAULT_NAME = 'Anonymous';

export type NicknameError = 'too_short' | 'too_long' | 'bad_chars' | 'mixed_scripts' | 'reserved';

// \p{L} in a lookahead so only real letters count, not other characters of the same script.
const LATIN_LETTER = /^(?=\p{L})\p{Script=Latin}$/u;
const CYRILLIC_LETTER = /^(?=\p{L})\p{Script=Cyrillic}$/u;
const NEUTRAL_CHAR = /^[0-9_\- ]$/;
const BOT_NAME = /^bot \d+$/;
// What a lower-cased key may contain: nothing but letters, digits, '_', '-' and space.
const KEY_CHARS = /^[\p{L}0-9_\- ]+$/u;

// The email local part is 'n' + 2 hex chars per UTF-8 byte of the key and must fit 64 chars.
const EMAIL_LOCAL_MAX = 64;
const KEY_MAX_BYTES = Math.floor((EMAIL_LOCAL_MAX - 1) / 2);

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Trim and collapse inner whitespace runs to one space. */
export function normalizeNickname(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
}

/** Identity of a nickname: two names are the same player when their keys match. */
export function nicknameKey(raw: string): string {
    return normalizeNickname(raw).toLowerCase();
}

/** First broken rule, or null when the nickname is allowed. */
export function validateNickname(raw: string): NicknameError | null {
    const chars = Array.from(normalizeNickname(raw)); // by code point, so emoji count as one
    if (chars.length < NICK_MIN) return 'too_short';
    if (chars.length > NICK_MAX) return 'too_long';

    let hasLatin = false;
    let hasCyrillic = false;
    for (const ch of chars) {
        if (LATIN_LETTER.test(ch)) hasLatin = true;
        else if (CYRILLIC_LETTER.test(ch)) hasCyrillic = true;
        else if (!NEUTRAL_CHAR.test(ch)) return 'bad_chars';
    }
    if (hasLatin && hasCyrillic) return 'mixed_scripts';

    // Wide letters (fullwidth, extended Latin/Cyrillic) and case mappings that grow (Ⱥ, İ)
    // can push the lower-cased key past what the email local part holds.
    const key = nicknameKey(raw);
    if (utf8(key).length > KEY_MAX_BYTES) return 'bad_chars';

    // A capital that lower-cases to letter + combining mark (İ -> i + U+0307) makes a key the database's
    // own lower() cannot reproduce, so the sign-up trigger would refuse it.
    if (!KEY_CHARS.test(key)) return 'bad_chars';

    if (key === GUEST_DEFAULT_NAME.toLowerCase() || BOT_NAME.test(key)) return 'reserved';
    return null;
}

/** Stable fake address for a nickname: hex of its UTF-8 key (12 Cyrillic letters = 48 hex chars). */
export function nicknameToEmail(raw: string): string {
    const bytes = utf8(nicknameKey(raw));
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `n${hex}@players.invalid`;
}
