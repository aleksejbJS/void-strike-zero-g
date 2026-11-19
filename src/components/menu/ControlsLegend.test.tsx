import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DEFAULT_BINDINGS } from '../../game/input/bindings';
import { saveBindings } from '../../game/input/bindingStorage';
import { installMemoryStorage } from '../../test/memoryStorage';
import { t } from '../hud/hudTestKit';
import { ControlsLegend } from './ControlsLegend';

describe('ControlsLegend', () => {
    beforeEach(() => { installMemoryStorage(); });

    it('shows the default keys', () => {
        render(<ControlsLegend t={t} />);
        expect(screen.getByText('WASD')).toBeInTheDocument();
        expect(screen.getByText('Space')).toBeInTheDocument();
        expect(screen.getByText('Jump')).toBeInTheDocument();
    });

    it('follows a change made in the profile while the menu stays mounted underneath', () => {
        render(<ControlsLegend t={t} />);
        act(() => saveBindings({ ...DEFAULT_BINDINGS, jetpack: ['KeyE', null] }));
        expect(screen.getByText('A D')).toBeInTheDocument();
        expect(screen.getByText('E')).toBeInTheDocument();
        expect(screen.queryByText('WASD')).not.toBeInTheDocument();
    });
});
