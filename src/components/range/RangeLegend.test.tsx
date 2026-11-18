import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRangeState, RangeState } from '../../game/range/rangeState';
import { RangeLegend } from './RangeLegend';

const lines = () => screen.getAllByRole('listitem').map(li => li.textContent);

describe('RangeLegend', () => {
    it('lists every range key with the starting values', () => {
        render(<RangeLegend range={createRangeState()} />);
        expect(lines()).toEqual([
            '1–9 weapons',
            'C stance: stand',
            'K armour: off',
            'H hit zones: off',
            'R reset',
            'Esc exit',
        ]);
    });

    it('shows the current stance, armour and hit zones', () => {
        const range: RangeState = { ...createRangeState(), stance: 'prone', armored: true, showHitZones: true };
        render(<RangeLegend range={range} />);
        expect(screen.getByText('C stance: prone')).toBeInTheDocument();
        expect(screen.getByText('K armour: on')).toBeInTheDocument();
        expect(screen.getByText('H hit zones: on')).toBeInTheDocument();
    });

    it('follows a new copy of the settings after a re-render', () => {
        const { rerender } = render(<RangeLegend range={createRangeState()} />);
        rerender(<RangeLegend range={{ ...createRangeState(), stance: 'crouch' }} />);
        expect(screen.getByText('C stance: crouch')).toBeInTheDocument();
    });

    it('does not take mouse events away from the game', () => {
        render(<RangeLegend range={createRangeState()} />);
        expect(screen.getByRole('list', { name: 'Test range keys' }).parentElement).toHaveClass('pointer-events-none');
    });
});
