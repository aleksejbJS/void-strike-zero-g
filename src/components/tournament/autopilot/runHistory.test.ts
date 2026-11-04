import { describe, it, expect, beforeEach } from 'vitest';
import { forgetRunHistory, hasForfeited, hasLeft, markForfeit, markNoShow } from './runHistory';

beforeEach(() => forgetRunHistory());

describe('runHistory: matches this page left for good', () => {
    it('a forfeit covers the match whatever the host peer id', () => {
        markForfeit('m1');
        expect(hasForfeited('m1')).toBe(true);
        expect(hasLeft('m1', 'peer-1')).toBe(true);
        expect(hasLeft('m1', null)).toBe(true);
        expect(hasLeft('m2', 'peer-1')).toBe(false);
    });

    it('a no-show covers one host peer id only', () => {
        markNoShow('m1', 'peer-1');
        expect(hasLeft('m1', 'peer-1')).toBe(true);
        expect(hasLeft('m1', 'peer-2')).toBe(false);
        expect(hasForfeited('m1')).toBe(false);
    });

    it('a fresh page session forgets both', () => {
        markForfeit('m1');
        markNoShow('m2', 'p');
        forgetRunHistory();
        expect(hasLeft('m1', null)).toBe(false);
        expect(hasLeft('m2', 'p')).toBe(false);
    });
});
