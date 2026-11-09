// Header button of the main menu: opens the Top screen (leaderboards). Hidden when accounts are
// disabled in this build: the boards live in Supabase.

import React from 'react';
import { useAccount } from '../../account/useAccount';
import type { Translate } from './types';

export const TopButton: React.FC<{ onOpen: () => void; t: Translate }> = ({ onOpen, t }) => {
    const { status } = useAccount();
    if (status === 'disabled') return null;
    return (
        <button type="button" onClick={onOpen}
            className="flex h-11 shrink-0 items-center gap-2 rounded border-2 border-bay-edge bg-bay-steel px-3 text-[15px] font-semibold hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard sm:px-4 phone:h-9 phone:px-3">
            {/* A small podium */}
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-bay-hazard">
                <path fill="currentColor" d="M6 4h4v11H6zM1 8h4v7H1zM11 10h4v5h-4z" />
            </svg>
            {/* A narrow portrait phone shows the podium alone, leaving the room to the nickname next to it */}
            <span className="sr-only sm:not-sr-only">{t('lb.menu')}</span>
        </button>
    );
};
