// The bar that fills while the held weapon reloads (desktop ammo box and the phone weapon slot).

import React from 'react';

interface Props {
    progress: number; // 0..1
    label: string;
    className?: string;
}

export const ReloadBar: React.FC<Props> = ({ progress, label, className = '' }) => (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
        className={`h-1.5 overflow-hidden rounded-full bg-bay-plate ${className}`}>
        <div className="h-full bg-bay-hazard" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
);
