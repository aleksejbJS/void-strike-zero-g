// Test double of MatchTile for the watch screen tests: records each tile's latest props and how often
// each peer's tile was mounted. Kept apart from watchScreenTestKit so the vi.mock factory imports nothing
// that imports MatchTile again.

import React, { useEffect, useRef } from 'react';
import type { MatchTileProps } from './MatchTile';

/** The latest props of each mounted fake tile, by peer id. */
export const tiles = new Map<string, MatchTileProps>();
/** How often each peer's tile was mounted. */
export const mounts = new Map<string, number>();

export const FakeTile: React.FC<MatchTileProps> = (props) => {
    const own = useRef(props);
    own.current = props;
    tiles.set(props.peerId, props);
    useEffect(() => {
        mounts.set(props.peerId, (mounts.get(props.peerId) ?? 0) + 1);
        // A remount renders the new tile before this cleanup runs: only forget props that are still ours
        return () => { if (tiles.get(props.peerId) === own.current) tiles.delete(props.peerId); };
    }, [props.peerId]);
    return <div data-testid="tile" data-peer={props.peerId} data-audible={String(props.audible)} data-expanded={String(props.expanded)} />;
};

export const resetTiles = () => { tiles.clear(); mounts.clear(); };
