// Start-up without the cloud: a stored session stays logged in under the nickname cached at its last
// login, keeps collecting pushes and sends them once the browser is back online. No session: a guest.

import { describe, it, expect } from 'vitest';
import { achievementManager } from '../game/systems/achievements';
import { ALEX, installAccountHarness } from '../test/accountHarness';
import { failed, makeFakeSupabase, ok, Result } from '../test/fakeSupabase';
import { createAccountApi } from './accountApi';
import { DEFAULT_DEBOUNCE_MS } from './sync';

const offline = (): Result => failed({ message: 'TypeError: Failed to fetch' });

describe('AccountProvider start-up without the cloud', () => {
    const h = installAccountHarness();

    it('a login remembers the nickname for this account', async () => {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        expect(h.store[`accountNick:${ALEX.id}`]).toBe('Alex');
    });

    it('a stored session stays logged in with the cached nickname; pushes go out once online', async () => {
        h.store[`accountNick:${ALEX.id}`] = 'Alex';
        const over = { getSession: async () => ok({ session: { user: { id: ALEX.id } } }), profile: offline(), progress: offline() };
        const fake = makeFakeSupabase(over);
        h.mount(createAccountApi(fake.client));
        await h.settle();

        expect(h.account().status).toBe('loggedIn');
        expect(h.account().nickname).toBe('Alex');
        expect(h.store[`accountDirty:${ALEX.id}`]).toBe('1'); // the failed pull left it to push later

        achievementManager.updateProgress('first_blood'); // push triggers are live
        await h.advance(DEFAULT_DEBOUNCE_MS);
        expect(fake.upsert).not.toHaveBeenCalled(); // still offline

        over.progress = ok(null);
        window.dispatchEvent(new Event('online'));
        await h.settle();

        expect(fake.upsert).toHaveBeenCalledTimes(1);
        const row = fake.upsert.mock.calls[0][0] as { user_id: string; data: { achievements: Record<string, unknown> } };
        expect(row.user_id).toBe(ALEX.id);
        expect(row.data.achievements.first_blood).toMatchObject({ unlocked: true });
        expect(h.store[`accountDirty:${ALEX.id}`]).toBeUndefined();
    });

    it('without a stored session a cached nickname still means a guest', async () => {
        h.store[`accountNick:${ALEX.id}`] = 'Alex';
        const fake = makeFakeSupabase({ profile: offline(), progress: offline() });
        h.mount(createAccountApi(fake.client));
        await h.settle();
        expect(h.account().status).toBe('guest');
        expect(h.account().nickname).toBeNull();
    });
});
