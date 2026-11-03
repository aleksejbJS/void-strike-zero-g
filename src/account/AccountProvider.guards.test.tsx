import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { ALEX, deferred, installAccountHarness } from '../test/accountHarness';
import { AccountError } from './accountError';

// "Not available right now" rejects with AccountError('network') the UI can show; an action the state
// does not allow at all (a programming mistake) rejects with a plain Error.
describe('AccountProvider action guards', () => {
    const h = installAccountHarness();
    const network = { name: 'AccountError', code: 'network' };

    it('rejects login and logout with a network AccountError while start-up is still running', async () => {
        h.api.currentUser.mockReturnValue(deferred<null>().promise);
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('loading');
        await expect(h.account().logIn('Alex', 'secret')).rejects.toMatchObject(network);
        await expect(h.account().signUp('Alex', 'secret')).rejects.toMatchObject(network);
        await expect(h.account().logOut()).rejects.toMatchObject(network);
        expect(h.api.logIn).not.toHaveBeenCalled();
        expect(h.api.signUp).not.toHaveBeenCalled();
    });

    it('rejects everything with a network AccountError when accounts are disabled', async () => {
        h.mount(null);
        await h.settle();
        await expect(h.account().logIn('Alex', 'secret')).rejects.toMatchObject(network);
        await expect(h.account().logOut()).rejects.toMatchObject(network);
        await expect(h.account().isNicknameTaken('Alex')).rejects.toMatchObject(network);
    });

    it('treats logging in twice, or out as a guest, as a programming mistake', async () => {
        h.mount();
        await h.settle();
        const asGuest = h.account().logOut();
        await expect(asGuest).rejects.toThrow(/not logged in/);
        await expect(asGuest).rejects.not.toBeInstanceOf(AccountError);
        await h.loginAs(ALEX);
        const again = h.account().logIn('Alex', 'secret');
        await expect(again).rejects.toThrow(/already logged in/);
        await expect(again).rejects.not.toBeInstanceOf(AccountError);
    });

    // A closed account window may leave its call running: a second one is "try again in a moment".
    it('rejects a second login started while the first is running with a network AccountError', async () => {
        const first = deferred<typeof ALEX>();
        h.api.logIn.mockReturnValueOnce(first.promise);
        h.mount();
        await h.settle();
        let running!: Promise<void>;
        await act(async () => { running = h.account().logIn('Alex', 'secret'); });
        await expect(h.account().logIn('Alex', 'secret')).rejects.toMatchObject(network);
        await act(async () => { first.resolve(ALEX); await running; });
        expect(h.account().status).toBe('loggedIn');
        expect(h.api.logIn).toHaveBeenCalledTimes(1);
    });

    it('rejects a second logout while the first is still saving, with a network AccountError', async () => {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        const save = deferred<void>();
        h.api.saveSnapshot.mockReturnValue(save.promise);
        let first!: Promise<void>;
        await act(async () => { first = h.account().logOut(); });
        expect(h.account().status).toBe('loggedIn'); // still sending the last progress
        await expect(h.account().logOut()).rejects.toMatchObject(network);
        await act(async () => { save.resolve(); await first; });
        expect(h.account().status).toBe('guest');
        expect(h.api.logOut).toHaveBeenCalledTimes(1);
    });

    it('asks to retry a login while the previous logout request is still running', async () => {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        const request = deferred<void>();
        h.api.logOut.mockReturnValue(request.promise);
        let loggingOut!: Promise<void>;
        await act(async () => { loggingOut = h.account().logOut(); });
        await h.settle();
        expect(h.account().status).toBe('guest');
        await expect(h.account().logIn('Alex', 'secret')).rejects.toMatchObject(network);
        await act(async () => { request.resolve(); await loggingOut; });
        await h.loginAs(ALEX);
        expect(h.account().status).toBe('loggedIn');
    });
});
