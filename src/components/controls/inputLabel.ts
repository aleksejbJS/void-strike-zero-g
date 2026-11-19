// Human names of bindable inputs: what the profile slots and the menu legend print.

import type { InputCode } from '../../game/input/bindings';
import type { Translate } from '../menu/types';

const NAMED: Readonly<Record<string, string>> = {
    Control: 'Ctrl',
    ArrowLeft: '←',
    ArrowUp: '↑',
    ArrowRight: '→',
    ArrowDown: '↓',
};

const MOUSE_KEYS = ['kb.mouse.0', 'kb.mouse.1', 'kb.mouse.2', 'kb.mouse.3', 'kb.mouse.4'] as const;

export function inputLabel(code: InputCode, t: Translate): string {
    if (code === 'Space') return t('kb.key.space');
    const mouse = /^Mouse([0-4])$/.exec(code);
    if (mouse) return t(MOUSE_KEYS[Number(mouse[1])]);
    const key = /^Key([A-Z])$/.exec(code) ?? /^Digit([0-9])$/.exec(code);
    if (key) return key[1];
    const numpad = /^Numpad(\w+)$/.exec(code);
    if (numpad) return `Num ${numpad[1]}`;
    return NAMED[code] ?? code;
}
