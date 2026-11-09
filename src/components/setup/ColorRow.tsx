// One body-part color row: preset swatches plus a "custom" color picker.

import React from 'react';

interface Props {
    label: string;
    groupLabel: string;
    customLabel: string;
    presets: { color: string; name: string }[];
    value: string;
    onChange: (color: string) => void;
}

const ring = 'outline outline-[3px] outline-offset-2 outline-bay-hazard';

export const ColorRow: React.FC<Props> = ({ label, groupLabel, customLabel, presets, value, onChange }) => {
    const isPreset = presets.some(p => p.color.toLowerCase() === value.toLowerCase());
    return (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 border-b border-[#806344] py-2.5 last:border-b-0">
            <span className="text-base font-semibold">{label}</span>
            <div role="radiogroup" aria-label={groupLabel} className="flex flex-wrap gap-2">
                {presets.map(p => {
                    const on = p.color.toLowerCase() === value.toLowerCase();
                    return (
                        <button key={p.color} type="button" role="radio" aria-checked={on} aria-label={p.name} onClick={() => onChange(p.color)}
                            className={`ap-swatch h-11 w-11 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-chalk ${on ? ring : ''}`}
                            style={{ background: p.color }} />
                    );
                })}
                {/* Native color picker styled as a swatch; shows the custom color once picked */}
                <label className={`relative flex h-11 cursor-pointer items-center gap-2 rounded border-2 border-dashed border-bay-edge px-3 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-bay-chalk ${!isPreset ? ring : ''}`}>
                    {!isPreset && <span aria-hidden="true" className="h-5 w-5 rounded-sm" style={{ background: value }} />}
                    {customLabel}
                    <input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={`${groupLabel}: ${customLabel}`}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
            </div>
        </div>
    );
};
