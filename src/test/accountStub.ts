// A hand-made AccountState for component tests that only need a status (no provider, no timers).

import { vi } from 'vitest';
import type { AccountState } from '../account/useAccount';

export const stubAccount = (over: Partial<AccountState> = {}): AccountState => ({
    status: 'guest',
    nickname: null,
    signUp: vi.fn().mockResolvedValue(undefined),
    logIn: vi.fn().mockResolvedValue(undefined),
    logOut: vi.fn().mockResolvedValue(undefined),
    isNicknameTaken: vi.fn().mockResolvedValue(false),
    ...over,
});
