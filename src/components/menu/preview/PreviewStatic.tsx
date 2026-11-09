// Shown in the mode preview while the live scene starts: old-monitor static with a
// "tuning in" caption, so the frame never flashes the schematic fallback scene.

import React from 'react';
import type { Translate } from '../types';
import './previewStatic.css';

export const PreviewStatic: React.FC<{ t: Translate }> = ({ t }) => (
    <div data-testid="preview-static" className="ap-static">
        <div className="ap-static-noise" />
        <div className="ap-static-band" />
        <span className="ap-static-caption">{t('pv.tuning')}</span>
    </div>
);
