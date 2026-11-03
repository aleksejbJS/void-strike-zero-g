// Small pulsing blood drop shown right after the HP number while the fighter bleeds (railgun wound).

import React from 'react';

const SIZE = { md: 'h-[18px] w-[18px]', sm: 'h-3 w-3' } as const;

interface Props {
    label: string;
    size?: keyof typeof SIZE;
    className?: string; // placement next to the number (margin, alignment)
}

export const BleedingDrop: React.FC<Props> = ({ label, size = 'md', className = '' }) => (
    <svg role="img" aria-label={label} viewBox="0 0 24 24"
        className={`inline-block shrink-0 ${SIZE[size]} animate-pulse text-bay-signal drop-shadow-[0_0_4px_rgba(255,77,46,0.7)] motion-reduce:animate-none ${className}`}>
        <path fill="currentColor" d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
    </svg>
);
