// Schematic previews for team modes: Capture the Flag, Hold the Flag, Infiltration

import React from 'react';
import { Badge, BaseFlag, COLORS, Figure, Pop, Tracer } from './previewParts';
import type { Translate } from './types';

const TeamScore: React.FC<{ left: [string, number, string]; right: [number, string, string] }> = ({ left, right }) => (
    <Badge pos={{ left: '50%', top: 12, transform: 'translateX(-50%)' }}>
        <span className="font-display text-xl font-extrabold">
            <span style={{ color: left[2] }}>{left[0]} {left[1]}</span>
            <span className="mx-2 text-bay-dust">:</span>
            <span style={{ color: right[2] }}>{right[0]} {right[1]}</span>
        </span>
    </Badge>
);

export const CtfScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <BaseFlag x={30} color={COLORS.blue} />
        <BaseFlag x={580} />
        <span className="absolute text-xs font-semibold text-blue-300" style={{ left: 12, top: 278 }}>{t('pv.blueBase')}</span>
        <span className="absolute text-xs font-semibold text-red-300" style={{ left: 528, top: 278 }}>{t('pv.redBase')}</span>
        <Figure x={560} y={234} body={COLORS.blue} carry={COLORS.red} flame animation="hb-carry 6s ease-in-out infinite" />
        <Figure x={600} y={230} body={COLORS.red} head={COLORS.redHead} flame animation="hb-chase 6s ease-in-out 0.5s infinite" />
        <TeamScore left={[t('pv.blue'), 2, '#93C5FD']} right={[1, t('pv.red'), '#FCA5A5']} />
    </>
);

export const HoldFlagScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <Figure x={300} y={76} body={COLORS.red} head={COLORS.redHead} carry={COLORS.hazard} animation="hb-bob 2.6s ease-in-out infinite" />
        <Pop x={318} y={56} text="+1" duration="4s" />
        <Figure x={100} y={180} body={COLORS.blue} flame animation="hb-fly-a 4.6s ease-in-out infinite" />
        <Figure x={480} y={180} body={COLORS.blue} flame animation="hb-fly-b 5s ease-in-out infinite" />
        <TeamScore left={[t('pv.red'), 37, '#FCA5A5']} right={[29, t('pv.blue'), '#93C5FD']} />
    </>
);

export const InfiltrationScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <div className="absolute flex justify-center rounded border-2 border-dashed border-green-400 pt-1.5 text-xs font-semibold text-green-300"
            style={{ left: 12, top: 210, width: 110, height: 88 }}>
            {t('pv.extraction')}
        </div>
        <Figure x={560} y={252} body={COLORS.blue} intel animation="hb-carry 7s ease-in-out infinite" />
        <Figure x={470} y={180} body={COLORS.red} head={COLORS.redHead} flame animation="hb-fly-b 4.2s ease-in-out infinite" />
        <Tracer x={450} y={192} color="#FF8F78" dir="l" duration="1.2s" />
        <Badge pos={{ left: '50%', top: 12, transform: 'translateX(-50%)' }}>{t('pv.redHolds', '2:41')}</Badge>
    </>
);
