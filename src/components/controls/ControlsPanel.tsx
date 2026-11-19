// The profile's Controls tab: every action with two slots, "Press a key…" capture, conflicts and Reset all.
// Every change is saved at once (this browser only).

import React, { useCallback, useState } from 'react';
import { BIND_ACTIONS, BindAction, Bindings, DEFAULT_BINDINGS, InputCode, Slot } from '../../game/input/bindings';
import { assignBinding, clearBinding, FreedSlot, unboundActions } from '../../game/input/bindingEdit';
import { loadBindings, saveBindings } from '../../game/input/bindingStorage';
import { useTranslation } from '../../i18n/useTranslation';
import { BindingRow } from './BindingRow';
import { useCaptureInput } from './useCaptureInput';

interface Target { action: BindAction; slot: Slot }

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';

export const ControlsPanel: React.FC = () => {
    const { t } = useTranslation();
    const [bindings, setBindings] = useState<Bindings>(loadBindings);
    const [capturing, setCapturing] = useState<Target | null>(null);
    const [freed, setFreed] = useState<FreedSlot | null>(null);

    const commit = useCallback((next: Bindings, nextFreed: FreedSlot | null) => {
        setBindings(next);
        setFreed(nextFreed);
        saveBindings(next);
    }, []);

    const onCapture = useCallback((code: InputCode) => {
        if (!capturing) return;
        const result = assignBinding(bindings, capturing.action, capturing.slot, code);
        setCapturing(null);
        commit(result.bindings, result.freed);
    }, [bindings, capturing, commit]);
    const onCancel = useCallback(() => setCapturing(null), []);
    useCaptureInput(capturing !== null, onCapture, onCancel);

    const pick = (action: BindAction, slot: Slot) => {
        setFreed(null);
        setCapturing({ action, slot });
    };

    const unbound = unboundActions(bindings);
    return (
        <div className="flex min-w-0 flex-col gap-3 phone:gap-1.5">
            <p className="m-0 text-sm text-bay-dust phone:text-xs">{t('kb.hint')}</p>
            <ul aria-label={t('kb.tab.controls')} className="m-0 max-w-[640px] list-none p-0">
                {BIND_ACTIONS.map(action => (
                    <BindingRow key={action} action={action} slots={bindings[action]} t={t}
                        capturingSlot={capturing?.action === action ? capturing.slot : null}
                        freedSlot={freed?.action === action ? freed.slot : null}
                        onPick={slot => pick(action, slot)}
                        onClear={() => commit(clearBinding(bindings, action, 1), null)} />
                ))}
            </ul>
            {unbound.length > 0 && (
                <p role="alert" className="m-0 text-sm font-semibold text-bay-signal phone:text-xs">
                    {t('kb.unbound', unbound.map(a => t(`kb.action.${a}`)).join(', '))}
                </p>
            )}
            <div>
                <button type="button" onClick={() => { setCapturing(null); commit(DEFAULT_BINDINGS, null); }}
                    className={`ap-button h-9 rounded border-2 border-bay-edge bg-bay-steel px-4 text-sm font-semibold hover:bg-bay-plate phone:h-7 phone:text-xs ${focusRing}`}>
                    {t('kb.reset')}
                </button>
            </div>
        </div>
    );
};
