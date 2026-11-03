// Shared by the profile screen tests: the screen inside UIProvider + AccountProvider (with the fake api of the
// account harness) and a helper to put achievements into the device's progress.

import React from 'react';
import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { AccountApi } from '../account/accountApi';
import { AccountProvider } from '../account/AccountProvider';
import { AccountState, useAccount } from '../account/useAccount';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { achievementManager } from '../game/systems/achievements';
import { UIProvider, useUIStore } from '../store/uiStore';
import type { AccountHarness } from './accountHarness';

/** Mounts the screen and lets the account start up. `api: null` means accounts are disabled. */
export async function mountProfile(h: AccountHarness, api: AccountApi | null = h.api as unknown as AccountApi) {
    const onBack = vi.fn();
    let latest: AccountState | null = null;
    let reloadPlayer: (() => void) | null = null;
    const Probe: React.FC = () => { latest = useAccount(); reloadPlayer = useUIStore().actions.reloadPlayer; return null; };
    const view = render(
        <UIProvider>
            <AccountProvider api={api}><Probe /><ProfileScreen onBack={onBack} /></AccountProvider>
        </UIProvider>,
    );
    await h.settle();
    return {
        onBack,
        view,
        account: (): AccountState => {
            if (!latest) throw new Error('the profile screen is not mounted');
            return latest;
        },
        /** The guest's saved name changes (the UI store reads storage at start-up and on reloadPlayer). */
        setGuestName: (name: string): void => {
            if (!reloadPlayer) throw new Error('the profile screen is not mounted');
            h.store.playerName = name;
            act(() => reloadPlayer?.());
        },
    };
}

/** Unlocks achievements on this device (progress is capped at the achievement's maximum). */
export const unlock = (...ids: string[]): void => {
    for (const id of ids) achievementManager.updateProgress(id, 1_000_000);
};
