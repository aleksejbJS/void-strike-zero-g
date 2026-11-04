// The two hand-overs between the guest's device data and an account: finishing a login (any kind:
// a restored session, sign-up or log-in) and logging out. Their step order is what keeps progress safe.

import { PLAYER_KEYS, writeStored } from '../store/playerStorage';
import type { AccountApi, AccountUser } from './accountApi';
import { clearDeviceOwner, readDeviceOwner, setAsideForAccount, setDeviceOwner } from './deviceOwner';
import { clearLocalSnapshot, readLocalSnapshot, writeLocalSnapshot } from './localSnapshot';
import { cacheNickname } from './nicknameCache';
import { savePending, takePending } from './pendingStore';
import { mergeSnapshots } from './snapshot';
import type { Sync } from './sync';

/**
 * Brings the device in line with the account that just logged in. Never rejects: a cloud that cannot
 * be reached leaves the progress marked unsent, to be pushed later, and the player stays logged in.
 */
export async function completeLogin(sync: Sync, user: AccountUser, reloadPlayer: () => void): Promise<void> {
    // 0. The device still holds another account's progress (its session died without a logout here): keep
    //    it for that account and start from a clean guest, so it never leaks into this one.
    const owner = readDeviceOwner();
    if (owner !== null && owner !== user.id) {
        console.warn(`[account] this device still held the progress of user ${owner}; kept it for that account's next login`);
        setAsideForAccount(owner);
    }

    // 1. Progress this account could not send before its last logout here. Merged and marked unsent before
    //    any network call, so a push that fails now cannot lose it (the dirty flag survives).
    const pending = takePending(user.id);
    if (pending) {
        writeLocalSnapshot(mergeSnapshots(readLocalSnapshot(), pending));
        sync.requestPush(user.id);
    }

    // 2. Logged in, the player's name is the account nickname. Also remembered per account, so a later
    //    start-up without the cloud can keep this session logged in under the right name.
    //    The device now holds this account's progress (see deviceOwner).
    writeStored(PLAYER_KEYS.name, user.nickname);
    cacheNickname(user.id, user.nickname);
    setDeviceOwner(user.id);

    // 3. Cloud -> local (also pushes back whatever the cloud lacks, e.g. the guest's progress).
    try {
        await sync.pull(user.id);
    } catch (error) {
        console.warn(`[account] could not load progress for user ${user.id}, keeping this device's copy:`, error);
        sync.requestPush(user.id); // so the local copy still reaches the cloud once it is reachable
    }

    // 4. Anything still unsent (an earlier failed push, or step 1) goes now; flush never rejects.
    if (sync.hasPending(user.id)) void sync.flush(user.id);

    // 5. Storage may have changed under the UI (name, skin, colours). Achievements in memory already follow
    //    storage: writeLocalSnapshot replaces them.
    reloadPlayer();
}

export interface LogOutSteps {
    api: AccountApi;
    sync: Sync;
    userId: string;
    reloadPlayer: () => void;
    /**
     * Called once the device is a clean guest (last push settled, `sync` disposed, local data cleared),
     * before the session itself is ended: stop pushing for this user and show the guest.
     */
    becomeGuest: () => void;
    /** The session already ended by itself (e.g. revoked): skip the logout request, there is nothing to end. */
    sessionGone?: boolean;
}

/**
 * Tries one last push, keeps on the device whatever could not be sent (under the account's id), leaves a
 * clean guest, then ends the session. The device is a guest before the (possibly slow) logout request:
 * anything earned while it runs is ordinary guest progress, not lost account progress.
 * Never rejects, so logging out always completes locally.
 */
export async function logOutFlow({ api, sync, userId, reloadPlayer, becomeGuest, sessionGone = false }: LogOutSteps): Promise<void> {
    const ok = await sync.flush(userId);
    // hasPending also catches a change made while that push was in flight (it is not in what was saved).
    if (!ok || sync.hasPending(userId)) savePending(userId, readLocalSnapshot());
    sync.dispose();
    clearLocalSnapshot();
    clearDeviceOwner();
    reloadPlayer();
    becomeGuest();
    if (sessionGone) return;

    try {
        await api.logOut();
    } catch (error) {
        // The device already forgot the player: its progress is in the cloud or kept as pending above.
        console.warn('[account] logout request failed, logged out on this device anyway:', error);
    }
}
