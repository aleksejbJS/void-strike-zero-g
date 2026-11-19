// The key hints of the main menu, built from the player's bindings. One key per action is shown (a keyboard
// key before a mouse button), the rest go to the tooltip. With the default layout they read exactly like the
// old fixed legend plus the jump ("WASD Move, W Jetpack, Space Jump, Left click Fire, Shift Grapple, …").

import type { BindAction, Bindings, InputCode } from '../../game/input/bindings';
import type { Translate } from '../menu/types';
import { inputLabel } from './inputLabel';

export interface LegendItem {
    label: 'ctl.move' | 'ctl.jetpack' | 'kb.action.jump' | 'ctl.fire' | 'ctl.grapple' | 'ctl.crouch' | 'ctl.proneShort';
    /** What the key cap shows. */
    shown: string;
    /** Tooltip: every input of the action, or the long name of the action. */
    title?: string;
}

const isWasd = (b: Bindings) =>
    b.left[0] === 'KeyA' && b.right[0] === 'KeyD' && b.jetpack[0] === 'KeyW' && b.down[0] === 'KeyS';

// The legend has always said "Left click" / "Right click" rather than the short LMB / RMB of the slots
const legendLabel = (code: InputCode, t: Translate): string =>
    code === 'Mouse0' ? t('ctl.leftClick') : code === 'Mouse2' ? t('ctl.rightClick') : inputLabel(code, t);

const isMouse = (code: InputCode) => code.startsWith('Mouse');

const firstShown = (codes: readonly InputCode[]): InputCode | undefined => codes.find(c => !isMouse(c)) ?? codes[0];

export function legendItems(b: Bindings, t: Translate): LegendItem[] {
    const codes = (action: BindAction) => b[action].filter((c): c is InputCode => c !== null);
    const item = (label: LegendItem['label'], list: InputCode[]): LegendItem | null => {
        const shown = firstShown(list);
        if (shown === undefined) return null;
        const result: LegendItem = { label, shown: legendLabel(shown, t) };
        if (list.length > 1) result.title = list.map(code => legendLabel(code, t)).join(` ${t('ctl.or')} `);
        return result;
    };

    const wasd = isWasd(b);
    const sides = [firstShown(codes('left')), firstShown(codes('right'))].filter((c): c is InputCode => c !== undefined);
    const move: LegendItem | null = wasd ? { label: 'ctl.move', shown: 'WASD' }
        : sides.length > 0 ? { label: 'ctl.move', shown: sides.map(code => legendLabel(code, t)).join(' ') } : null;
    // Under WASD the jetpack's W is already on the move key; list the rest, or W itself when there is nothing else
    const jetpackRest = codes('jetpack').filter(code => code !== 'KeyW');
    const prone = item('ctl.proneShort', codes('prone'));

    return [
        move,
        item('ctl.jetpack', wasd && jetpackRest.length > 0 ? jetpackRest : codes('jetpack')),
        item('kb.action.jump', codes('jump')),
        item('ctl.fire', codes('fire')),
        item('ctl.grapple', codes('grapple')),
        item('ctl.crouch', codes('down')),
        prone && { ...prone, title: t('ctl.prone') },
    ].filter((i): i is LegendItem => i !== null);
}
