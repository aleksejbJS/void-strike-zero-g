// The player's current key bindings, re-read whenever they are saved.

import { useEffect, useState } from 'react';
import type { Bindings } from '../../game/input/bindings';
import { loadBindings, onBindingsChange } from '../../game/input/bindingStorage';

export function useBindings(): Bindings {
    const [bindings, setBindings] = useState(loadBindings);
    useEffect(() => onBindingsChange(() => setBindings(loadBindings())), []);
    return bindings;
}
