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

// One 7 s loop: blue walks to the intel, grabs it, jetpacks over the middle and lands in extraction
const INF_LOOP = '7s';
const RUN = `hb-inf-run ${INF_LOOP} ease-in-out infinite`;

export const InfiltrationScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <span className="absolute text-center text-xs font-semibold text-green-300" style={{ left: 56, top: 138, width: 120 }}>{t('pv.extraction')}</span>
        <div className="absolute rounded-t border-2 border-b-0 border-dashed border-green-400 bg-green-400/10" style={{ left: 56, top: 158, width: 120, height: 56 }} />

        {/* The intel case waiting on the red side */}
        <span className="hb-anim absolute text-xs font-semibold text-bay-hazard" style={{ left: 484, top: 148, animation: `hb-inf-case ${INF_LOOP} linear infinite` }}>{t('pv.intel')}</span>
        <div className="hb-anim absolute h-3 w-[18px] rounded-sm bg-bay-hazard" style={{ left: 492, top: 202, animation: `hb-inf-case ${INF_LOOP} linear infinite` }} />

        <Figure x={548} y={182} body={COLORS.red} head={COLORS.redHead} animation="hb-bob 2.4s ease-in-out infinite" />
        <Tracer x={500} y={192} color="#FF8F78" dir="l" duration="1.4s" delay="2s" />

        {/* Blue thief and the case it carries share the same path */}
        <Figure x={444} y={182} body={COLORS.blue} flame animation={`${RUN}, hb-inf-thief ${INF_LOOP} linear infinite`} />
        <div className="hb-anim absolute h-3 w-[18px] rounded-sm bg-bay-hazard" style={{ left: 441, top: 168, opacity: 0, animation: `${RUN}, hb-inf-held ${INF_LOOP} linear infinite` }} />
        <Pop x={182} y={150} text="+1" duration={INF_LOOP} delay="1.4s" />

        <Badge pos={{ left: '50%', top: 12, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{t('pv.infGoal', '2:41')}</Badge>
    </>
);
