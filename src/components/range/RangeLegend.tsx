// Key legend of the offline test range (#range): a small panel with what each key does and its current value.
// Pure: it shows the settings it is given. GameCanvas passes a copy that is refreshed when a key is pressed.

import React from 'react';
import type { RangeState } from '../../game/range/rangeState';
import { PANEL } from '../hud/hudIcons';

const onOff = (on: boolean) => (on ? 'on' : 'off');

export const RangeLegend: React.FC<{ range: RangeState }> = ({ range }) => (
    // Bottom-left, over the left wall and above the F3 FPS line (the vitals that sit there in a match are hidden here)
    <div className={`${PANEL} pointer-events-none absolute bottom-[260px] left-8 z-40 px-3.5 py-2.5 font-mono text-xs leading-5`}>
        <ul aria-label="Test range keys" className="m-0 list-none p-0">
            <li>1–9 weapons</li>
            <li>{`C stance: ${range.stance}`}</li>
            <li>{`K armour: ${onOff(range.armored)}`}</li>
            <li>{`H hit zones: ${onOff(range.showHitZones)}`}</li>
            <li>R reset</li>
            <li>Esc exit</li>
        </ul>
    </div>
);
