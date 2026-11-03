// Friendly text for everything that can go wrong in the sign-up / log-in window.

import { AccountError, AccountErrorCode } from '../../../account/accountError';
import { NICK_MAX, NICK_MIN, NicknameError } from '../../../account/nickname';
import { PASSWORD_MIN } from '../../../account/passwordRules';
import type { TranslationKeys } from '../../../i18n/locales';
import type { Translate } from '../../menu/types';

type Key = keyof TranslationKeys;

const NICKNAME_KEYS: Record<NicknameError, Key> = {
    too_short: 'ac.nick.too_short',
    too_long: 'ac.nick.too_long',
    bad_chars: 'ac.nick.bad_chars',
    mixed_scripts: 'ac.nick.mixed_scripts',
    reserved: 'ac.nick.reserved',
};

const ERROR_KEYS: Record<AccountErrorCode, Key> = {
    taken: 'ac.err.taken',
    bad_credentials: 'ac.err.bad_credentials',
    invalid_nickname: 'ac.err.invalid_nickname',
    weak_password: 'ac.err.weak_password',
    rate_limited: 'ac.err.rate_limited',
    network: 'ac.err.network',
};

/** The rule a nickname broke, with the limits filled in. */
export const nicknameMessage = (t: Translate, problem: NicknameError): string =>
    t(NICKNAME_KEYS[problem], problem === 'too_short' ? NICK_MIN : NICK_MAX);

/** The password rule (also what the server's "weak password" means). */
export const passwordMessage = (t: Translate): string => t('ac.err.weak_password', PASSWORD_MIN);

export const isPasswordTooShort = (password: string): boolean => password.length < PASSWORD_MIN;

/** Message for whatever a sign-up / log-in call rejected with; anything but an AccountError is a mistake in the app. */
export function accountErrorMessage(t: Translate, error: unknown): string {
    if (!(error instanceof AccountError)) return t('ac.err.unexpected');
    return error.code === 'weak_password' ? passwordMessage(t) : t(ERROR_KEYS[error.code]);
}
