import { describe, it, expect } from 'vitest';
import { DEFAULT_BINDINGS } from '../../game/input/bindings';
import { t } from '../hud/hudTestKit';
import { legendItems } from './legendItems';

describe('legendItems', () => {
    it('reads exactly like the old fixed legend for the default bindings', () => {
        expect(legendItems(DEFAULT_BINDINGS, t)).toEqual([
            { label: 'ctl.move', shown: 'WASD' },
            { label: 'ctl.jetpack', shown: 'W' },
            { label: 'kb.action.jump', shown: 'Space' },
            { label: 'ctl.fire', shown: 'Left click' },
            { label: 'ctl.grapple', shown: 'Shift', title: 'Right click or Shift' },
            { label: 'ctl.crouch', shown: 'S' },
            { label: 'ctl.proneShort', shown: 'Z', title: 'Lie down (hold)' },
        ]);
    });

    it('lists the player\'s own keys once the layout is no longer WASD', () => {
        const items = legendItems({ ...DEFAULT_BINDINGS, jetpack: ['KeyE', null] }, t);
        expect(items[0]).toEqual({ label: 'ctl.move', shown: 'A D' });
        expect(items[1]).toEqual({ label: 'ctl.jetpack', shown: 'E' });
    });

    it('shows a keyboard key before a mouse button and names all inputs in the title', () => {
        const items = legendItems({ ...DEFAULT_BINDINGS, fire: ['Mouse0', 'KeyF'] }, t);
        expect(items[3]).toEqual({ label: 'ctl.fire', shown: 'F', title: 'Left click or F' });
    });

    it('leaves out an action with no key', () => {
        const items = legendItems({ ...DEFAULT_BINDINGS, prone: [null, null] }, t);
        expect(items.map(i => i.label)).not.toContain('ctl.proneShort');
    });

    it('shows the jetpack\'s other key when WASD is kept and the jetpack has two', () => {
        const items = legendItems({ ...DEFAULT_BINDINGS, jetpack: ['KeyW', 'KeyE'] }, t);
        expect(items[1]).toEqual({ label: 'ctl.jetpack', shown: 'E' });
    });

    it('shows the jetpack key W when WASD is kept and it has no other', () => {
        const items = legendItems(DEFAULT_BINDINGS, t);
        expect(items[0].shown).toBe('WASD');
        expect(items[1]).toEqual({ label: 'ctl.jetpack', shown: 'W' });
    });
});
