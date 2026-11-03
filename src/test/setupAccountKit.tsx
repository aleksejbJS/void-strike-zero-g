// Shared by the setup-screen account tests: the screen inside UIProvider + AccountProvider (with the fake api
// of the account harness) and a probe of the UI store. The Pixi mocks stay in each test file (vi.mock is per file).

import React from 'react';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AccountApi } from '../account/accountApi';
import { AccountProvider } from '../account/AccountProvider';
import CharacterSetup from '../components/setup/CharacterSetup';
import { UIProvider, useUIStore } from '../store/uiStore';
import type { AccountHarness } from './accountHarness';

let latestUi: ReturnType<typeof useUIStore> | null = null;
const Spy: React.FC = () => { latestUi = useUIStore(); return null; };

/** The latest UI store (to check what Start saved). */
export const ui = (): ReturnType<typeof useUIStore> => {
    if (!latestUi) throw new Error('the setup screen is not mounted');
    return latestUi;
};

/** Mounts the screen and lets the account start up. `api: null` means accounts are disabled. */
export async function mountSetup(h: AccountHarness, api: AccountApi | null = h.api as unknown as AccountApi, onOpenProfile?: () => void) {
    const onContinue = vi.fn();
    const view = render(
        <UIProvider><Spy />
            <AccountProvider api={api}>
                <CharacterSetup onContinue={onContinue} onBack={vi.fn()} onOpenProfile={onOpenProfile} />
            </AccountProvider>
        </UIProvider>,
    );
    await h.settle();
    return { onContinue, view };
}

export const typeName = (value: string): boolean => fireEvent.change(screen.getByLabelText('Name'), { target: { value } });

export const clickStart = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

/** Clicks Start and lets the taken-name check finish. */
export async function startAndSettle(h: AccountHarness): Promise<void> {
    clickStart();
    await h.settle();
}
