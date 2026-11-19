// browserSetup replaces localStorage with empty vi.fn() mocks. Tests that need values to stick call this in
// beforeEach: the mocks then read and write a fresh in-memory store, which is returned for direct checks.

import type { Mock } from 'vitest';

export function installMemoryStorage(): Record<string, string> {
    const store: Record<string, string> = {};
    (localStorage.getItem as Mock).mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
    (localStorage.setItem as Mock).mockReset().mockImplementation((key: string, value: string) => { store[key] = String(value); });
    (localStorage.removeItem as Mock).mockReset().mockImplementation((key: string) => { delete store[key]; });
    (localStorage.clear as Mock).mockReset().mockImplementation(() => { for (const key in store) delete store[key]; });
    return store;
}
