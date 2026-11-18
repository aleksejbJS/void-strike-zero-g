// A mode preview drawn by the game: old-monitor static while it starts, the live canvas once
// it is running, the schematic scene only when it cannot run (no WebGL, failed start).

import React, { useMemo, useState } from 'react';
import { GameMode, MapId } from '../../../types';
import { useUIStore } from '../../../store/uiStore';
import { currentBuild } from '../../../game/build/currentBuild';
import { Stage } from '../previewParts';
import type { Translate } from '../types';
import { LiveScene } from './liveScenes';
import { PreviewCanvas } from './PreviewCanvas';
import { PreviewStatic } from './PreviewStatic';
import { YouLook } from './previewWorld';

type Status = 'starting' | 'running' | 'failed';

interface Props {
    mode: GameMode;
    map: MapId;
    live: LiveScene;
    label: string;
    t: Translate;
    Schematic: React.FC<{ t: Translate }>;
}

export const LiveStage: React.FC<Props> = ({ mode, map, live, label, t, Schematic }) => {
    const [status, setStatus] = useState<Status>('starting');
    const you = useYouLook();
    const running = status === 'running';
    const failed = status === 'failed';

    return (
        <Stage label={label} schematic={failed}>
            {failed && <Schematic t={t} />}
            {status === 'starting' && <PreviewStatic t={t} />}
            {!failed && (
                <div className={running ? '' : 'invisible'}>
                    <PreviewCanvas script={live.script} mode={mode} map={map} you={you} youText={t('pv.you')}
                        onReady={() => setStatus('running')} onFail={() => setStatus('failed')} />
                </div>
            )}
            {running && <live.Overlay t={t} />}
        </Stage>
    );
};

/** The viewer's own fighter, as set up in the character builder. */
const useYouLook = (): YouLook => {
    const { state } = useUIStore();
    const { headColor, torsoColor, armColor, legColor, jetpackColor, selectedSkin } = state;
    return useMemo(() => ({
        head: headColor, torso: torsoColor, arms: armColor, legs: legColor, jetpack: jetpackColor,
        skinId: selectedSkin, build: currentBuild(),
    }), [headColor, torsoColor, armColor, legColor, jetpackColor, selectedSkin]);
};
