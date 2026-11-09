import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { getSupabase } from '../../account/supabaseClient';
import { stubAccount } from '../../test/accountStub';
import MainMenu from './MainMenu';

vi.mock('../../account/supabaseClient', () => ({ getSupabase: vi.fn() }));

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

const renderMenu = () => render(
    <UIProvider><Spy />
        <AccountContext.Provider value={stubAccount({ status: 'disabled' })}>
            <MainMenu onCustomize={vi.fn()} onOpenProfile={vi.fn()} />
        </AccountContext.Provider>
    </UIProvider>,
);

beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    vi.mocked(getSupabase).mockReset();
});

describe('MainMenu Tournaments button', () => {
    it('stays visible without a service and explains its availability without opening a broken list', () => {
        vi.mocked(getSupabase).mockReturnValue(null);
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Tournaments' }));
        expect(screen.getByRole('dialog', { name: 'Tournaments' })).toBeInTheDocument();
        expect(screen.getByText('Tournaments are not available right now.')).toBeInTheDocument();
        expect(store.state.tournamentNav).toBeNull();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Play vs bots/ })).toBeInTheDocument();
    });

    it('opens the tournament list when Supabase is set up', () => {
        vi.mocked(getSupabase).mockReturnValue({} as SupabaseClient);
        renderMenu();
        fireEvent.click(screen.getByRole('button', { name: 'Tournaments' }));
        expect(store.state.tournamentNav).toEqual({ view: 'list' });
    });
});
