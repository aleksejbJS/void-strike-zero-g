import { describe, it, expect } from 'vitest';
import { PREDICTED_FIELDS } from './clientSession';

describe('PREDICTED_FIELDS', () => {
    it('keeps the local jump state, so a server snapshot never grants a second double jump', () => {
        expect(PREDICTED_FIELDS).toEqual(expect.arrayContaining(['jumpHeld', 'airJump', 'jumpRise']));
    });
});
