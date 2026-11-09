import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GameMode, MapId } from '../../../types';
import { UIProvider } from '../../../store/uiStore';
import { LIVE_SCENES } from './liveScenes';
import { LiveStage } from './LiveStage';

// The fake canvas hands its callbacks to the test, which decides when the scene starts or fails
const canvas: { onReady?: () => void; onFail?: () => void } = {};
vi.mock('./PreviewCanvas', () => ({
    PreviewCanvas: (props: { onReady: () => void; onFail: () => void }) => {
        canvas.onReady = props.onReady;
        canvas.onFail = props.onFail;
        return <div data-testid="live-canvas" />;
    },
}));

const t = (key: string) => key;
const Schematic: React.FC = () => <div data-testid="schematic" />;

const renderStage = () => {
    const live = LIVE_SCENES[GameMode.DEATHMATCH]!;
    render(<UIProvider><LiveStage mode={GameMode.DEATHMATCH} map={Object.values(MapId)[0]} live={live} label="Preview" t={t} Schematic={Schematic} /></UIProvider>);
};

beforeEach(() => {
    canvas.onReady = undefined;
    canvas.onFail = undefined;
});

describe('LiveStage', () => {
    it('shows static, not the old schematic scene, while the live scene starts', () => {
        renderStage();
        expect(screen.getByTestId('preview-static')).toBeInTheDocument();
        expect(screen.getByText('pv.tuning')).toBeInTheDocument();
        expect(screen.queryByTestId('schematic')).not.toBeInTheDocument();
    });

    it('drops the static once the live scene runs', () => {
        renderStage();
        act(() => canvas.onReady!());
        expect(screen.queryByTestId('preview-static')).not.toBeInTheDocument();
        expect(screen.queryByTestId('schematic')).not.toBeInTheDocument();
    });

    it('falls back to the schematic scene when the live scene cannot start', () => {
        renderStage();
        act(() => canvas.onFail!());
        expect(screen.getByTestId('schematic')).toBeInTheDocument();
        expect(screen.queryByTestId('preview-static')).not.toBeInTheDocument();
        expect(screen.queryByTestId('live-canvas')).not.toBeInTheDocument();
    });
});
