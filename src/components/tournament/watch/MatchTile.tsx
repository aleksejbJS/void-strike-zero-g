// One watched match: owns the link to the host (PeerSocket), the spectator session and the
// Pixi view, draws every animation frame and tells the watch screen its status and live score.
// The tile shows no text itself; the watch screen labels it from `onStatus`.

import React, { useEffect, useRef, useState } from 'react';
import { PeerSocket } from '../../../game/net/peerSocket';
import { SpectatorSession } from '../../../game/net/spectatorSession';
import { createMatchView, MatchView } from '../../../game/render/matchView/matchView';
import { playSound } from '../../../game/systems/audio';
import { WeaponType } from '../../../types';
import { emptyWatchState } from './watchState';

export type TileStatus = 'connecting' | 'live' | 'full' | 'ended' | 'host_left';
export interface TileScore { name: string; score: number }

export interface MatchTileProps {
    peerId: string;
    audible: boolean;
    expanded: boolean;
    onStatus?: (s: TileStatus) => void;
    onScore?: (players: TileScore[]) => void;
}

/** A host that never answers (closed tab, broker trouble) must not keep the tile waiting forever. */
export const WATCH_ANSWER_TIMEOUT_MS = 15_000;

type SoundName = Parameters<typeof playSound>[0];

const scoreKey = (players: readonly TileScore[]) => players.map(p => `${p.name}:${p.score}`).join('|');

export const MatchTile: React.FC<MatchTileProps> = ({ peerId, audible, expanded, onStatus, onScore }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MatchView | null>(null);
    const [status, setStatus] = useState<TileStatus>('connecting');
    // Latest props, read by the long-lived session and frame loop
    const audibleRef = useRef(audible);
    const expandedRef = useRef(expanded);
    const onStatusRef = useRef(onStatus);
    const onScoreRef = useRef(onScore);
    useEffect(() => {
        audibleRef.current = audible;
        onStatusRef.current = onStatus;
        onScoreRef.current = onScore;
    }, [audible, onStatus, onScore]);

    useEffect(() => { onStatusRef.current?.(status); }, [status]);

    useEffect(() => {
        expandedRef.current = expanded;
        viewRef.current?.setAdsEnabled(expanded); // ads only on a tile that fills the screen
    }, [expanded]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        setStatus('connecting');
        const state = emptyWatchState();
        let alive = true;
        let linkOpen = true;
        let frame = 0;
        let lastScoreKey = '';

        // The session latches its end, and a link that reconnects must not bring it back: close it for good
        const closeLink = () => {
            if (!linkOpen) return;
            linkOpen = false;
            clearTimeout(watchdog);
            session.dispose();
        };
        const watchdog = setTimeout(() => { closeLink(); setStatus('host_left'); }, WATCH_ANSWER_TIMEOUT_MS);
        const session = new SpectatorSession(new PeerSocket(peerId), {
            onWatching: () => { clearTimeout(watchdog); setStatus('live'); },
            onRejected: reason => {
                closeLink();
                if (reason !== 'spectators_full') console.warn(`[tournament] host refused to show match ${peerId}: ${reason}`);
                setStatus(reason === 'spectators_full' ? 'full' : 'host_left');
            },
            // A host closes the link after the final whistle too; only a finished match is "ended"
            onEnded: () => { closeLink(); setStatus(state.matchEndsAt ? 'ended' : 'host_left'); },
            onSound: e => {
                if (e.type === 'SOUND' && audibleRef.current) playSound(e.sound as SoundName, e.subtype as WeaponType | undefined);
            },
        });

        createMatchView(host).then(view => {
            if (!alive) { view.destroy(); return; }
            viewRef.current = view;
            view.setAdsEnabled(expandedRef.current);
        }).catch(err => console.error(`[tournament] match view for ${peerId} failed to start:`, err));

        const draw = () => {
            frame = requestAnimationFrame(draw);
            if (linkOpen) session.tick(state, performance.now());
            viewRef.current?.render(state, Date.now());
            const scores = state.players.map(p => ({ name: p.name, score: p.score }));
            const key = scoreKey(scores);
            if (key !== lastScoreKey) {
                lastScoreKey = key;
                onScoreRef.current?.(scores);
            }
        };
        frame = requestAnimationFrame(draw);

        return () => {
            alive = false;
            cancelAnimationFrame(frame);
            closeLink();
            viewRef.current?.destroy();
            viewRef.current = null;
        };
    }, [peerId]);

    return <div ref={hostRef} data-status={status} className="relative h-full w-full overflow-hidden bg-black" />;
};
