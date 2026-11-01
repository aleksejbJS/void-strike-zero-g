// Live test of a spot code on the admin page: the real banner in a frame that looks like
// the in-game one, plus whether anything actually showed up after a few seconds.

import React, { useEffect, useRef, useState } from 'react';
import { bannerDocument } from '../../game/ads/adOverlay';

type Status = 'loading' | 'filled' | 'empty';

const FRAME: Record<string, string> = {
    lightbox: 'brightness(0.82) contrast(0.95) saturate(0.9)',
    decal: 'brightness(0.74) sepia(0.15) saturate(0.85)',
    screen: 'brightness(0.86) saturate(0.95)',
};

let testSeq = 0;

export const BannerTest: React.FC<{ code: string; size: string; kind: string }> = ({ code, size, kind }) => {
    const [bw, bh] = size.split('x').map(Number);
    const frame = useRef<HTMLIFrameElement>(null);
    const [status, setStatus] = useState<Status>('loading');
    const [token] = useState(() => `vs-admin-${++testSeq}`);

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            const data = e.data as { voidStrikeAd?: string; filled?: boolean } | null;
            if (data?.voidStrikeAd === token && e.source === frame.current?.contentWindow) setStatus(data.filled ? 'filled' : 'empty');
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [token]);

    const scale = Math.min(1, 300 / bw);
    return (
        <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded border-4 border-[#2a323c] bg-[#0b0e12]" style={{ width: bw * scale + 8, height: bh * scale + 8 }}>
                <div style={{ width: bw, height: bh, transform: `scale(${scale})`, transformOrigin: '0 0', filter: FRAME[kind] }}>
                    <iframe ref={frame} title="Проверка спота" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={bannerDocument(code, token)} width={bw} height={bh} style={{ border: 0, display: 'block' }} />
                </div>
            </div>
            <span role="status" className={`text-sm ${status === 'filled' ? 'text-lime-300' : status === 'empty' ? 'text-bay-signal' : 'text-bay-dust'}`}>
                {status === 'loading' && 'Ждём ответ спота (до 5 секунд)…'}
                {status === 'filled' && 'Реклама показалась — в игре она встанет в эту рамку.'}
                {status === 'empty' && 'Спот ничего не показал. В игре здесь останется наш плакат. Проверьте код и размер спота.'}
            </span>
        </div>
    );
};
