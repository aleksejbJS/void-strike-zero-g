// One action of the Controls tab: its name, the primary and secondary slot, and Clear for the secondary.

import React from 'react';
import type { BindAction, BindingSlots, Slot } from '../../game/input/bindings';
import type { Translate } from '../menu/types';
import { inputLabel } from './inputLabel';

interface Props {
    action: BindAction;
    slots: BindingSlots;
    capturingSlot: Slot | null;
    freedSlot: Slot | null;
    onPick: (slot: Slot) => void;
    onClear: () => void;
    t: Translate;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const slotBase = `h-8 w-[168px] truncate rounded-[3px] border-2 border-b-[4px] px-2 font-body text-sm font-semibold phone:h-7 phone:w-[104px] phone:text-[11px] ${focusRing}`;

const slotLook = (capturing: boolean, freed: boolean): string =>
    capturing ? 'animate-pulse border-bay-hazard bg-bay-plate text-bay-hazard'
        : freed ? 'border-bay-signal bg-bay-steel text-bay-signal'
            : 'border-bay-edge bg-bay-steel text-bay-chalk hover:bg-bay-plate';

export const BindingRow: React.FC<Props> = ({ action, slots, capturingSlot, freedSlot, onPick, onClear, t }) => {
    const name = t(`kb.action.${action}`);
    return (
        <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(72px,auto)] items-center gap-2 border-b border-bay-plate py-1 phone:gap-1.5 phone:py-1">
            <span className="min-w-0 text-[15px] font-semibold text-bay-chalk phone:text-xs">{name}</span>
            {([0, 1] as const).map(slot => {
                const code = slots[slot];
                const capturing = capturingSlot === slot;
                const freed = freedSlot === slot;
                const text = capturing ? t('kb.press') : code ? inputLabel(code, t) : t('kb.empty');
                return (
                    <button key={slot} type="button" onClick={() => onPick(slot)}
                        aria-label={t('kb.slot', name, slot + 1, text)}
                        aria-invalid={freed || undefined}
                        title={freed ? t('kb.freed') : undefined}
                        className={`${slotBase} ${slotLook(capturing, freed)}`}>
                        {text}
                    </button>
                );
            })}
            {slots[1] !== null ? (
                <button type="button" onClick={onClear} aria-label={t('kb.clearSlot', name)}
                    className={`justify-self-start text-sm text-bay-dust underline-offset-2 hover:text-bay-chalk hover:underline phone:text-xs ${focusRing}`}>
                    {t('kb.clear')}
                </button>
            ) : <span aria-hidden="true" />}
        </li>
    );
};
