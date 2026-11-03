// The account's display nickname, remembered on this device per user id. The nickname itself lives in
// the cloud (`profiles`); this copy lets a stored session stay logged in when the cloud cannot be
// reached at start-up. It never logs anyone in on its own: it is read only for an existing session.

import { readStored, writeStored } from '../store/playerStorage';
import { validateNickname } from './nickname';

const NICK_PREFIX = 'accountNick:';
const nickKey = (userId: string): string => `${NICK_PREFIX}${userId}`;

/** True for a value that can be shown as an account nickname. */
export const isUsableNickname = (value: unknown): value is string =>
    typeof value === 'string' && validateNickname(value) === null;

export function cacheNickname(userId: string, nickname: string): void {
    writeStored(nickKey(userId), nickname);
}

/** The nickname last seen for this user on this device, or null. */
export function readCachedNickname(userId: string): string | null {
    const value = readStored(nickKey(userId));
    return isUsableNickname(value) ? value : null;
}
