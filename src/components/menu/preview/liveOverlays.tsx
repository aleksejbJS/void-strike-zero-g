// HTML texts laid over the live mode previews (scores, bases, zones, the Gun Game ladder), in
// stage px. Kept out of the canvas so they follow the menu language.

import React, { useEffect, useState } from 'react';
import { Badge } from '../previewParts';
import { LADDER_KEYS } from '../scenesSolo';
import { TeamScore } from '../scenesTeam';
import type { Translate } from '../types';
import { toStage, LOW_Y } from './previewWorld';
import { GUN_GAME_LOOP, GUN_GAME_STEPS } from './scripts/gunGame';
import { BLUE_BASE_X, RED_BASE_X } from './scripts/ctf';
import { EXTRACTION } from './scripts/infiltration';

const BLUE_TEXT = '#93C5FD';
const RED_TEXT = '#FCA5A5';
const UNDER_DECK = toStage({ x: 0, y: LOW_Y + 36 }).y;

/** Ladder rung lit at loop time t. */
export const rungAt = (t: number) => GUN_GAME_STEPS.filter(s => s.t <= t).pop()?.rung ?? GUN_GAME_STEPS[0].rung;

/** Seconds into a loop that started when the overlay mounted (the canvas starts in the same frame). */
const useLoopRung = () => {
    const [rung, setRung] = useState(GUN_GAME_STEPS[0].rung);
    useEffect(() => {
        const start = performance.now();
        const id = setInterval(() => setRung(rungAt(((performance.now() - start) / 1000) % GUN_GAME_LOOP)), 100);
        return () => clearInterval(id);
    }, []);
    return rung;
};

export const GunGameOverlay: React.FC<{ t: Translate }> = ({ t }) => {
    const rung = useLoopRung();
    return (
        <div className="absolute inset-x-2 top-2.5 grid grid-cols-6 gap-1">
            {LADDER_KEYS.map((key, i) => (
                <span key={key} className={`flex h-[34px] items-center justify-center rounded-sm px-1 text-center text-[11px] font-semibold leading-tight ${i === rung ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-ink/85 text-bay-chalk'}`}>
                    {t(key)}
                </span>
            ))}
        </div>
    );
};

const BaseLabel: React.FC<{ x: number; color: string; text: string }> = ({ x, color, text }) => (
    <span className="absolute -translate-x-1/2 whitespace-nowrap rounded-sm bg-bay-ink/80 px-1.5 text-xs font-semibold"
        style={{ left: toStage({ x, y: 0 }).x, top: UNDER_DECK, color }}>{text}</span>
);

export const CtfOverlay: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <BaseLabel x={BLUE_BASE_X + 40} color={BLUE_TEXT} text={t('pv.blueBase')} />
        <BaseLabel x={RED_BASE_X - 40} color={RED_TEXT} text={t('pv.redBase')} />
        {/* Top right: the carrier flies over the top middle */}
        <TeamScore left={[t('pv.blue'), 2, BLUE_TEXT]} right={[1, t('pv.red'), RED_TEXT]} pos={{ right: 12, top: 12 }} />
    </>
);

export const HoldFlagOverlay: React.FC<{ t: Translate }> = ({ t }) => (
    <TeamScore left={[t('pv.red'), 37, RED_TEXT]} right={[29, t('pv.blue'), BLUE_TEXT]} />
);

export const InfiltrationOverlay: React.FC<{ t: Translate }> = ({ t }) => {
    const zone = toStage(EXTRACTION);
    const size = toStage({ x: EXTRACTION.w, y: EXTRACTION.h });
    return (
        <>
            <div className="absolute rounded-t border-2 border-b-0 border-dashed border-green-400 bg-green-400/10"
                style={{ left: zone.x, top: zone.y, width: size.x, height: size.y }} />
            <span className="absolute text-center text-xs font-semibold text-green-300" style={{ left: zone.x, top: zone.y - 18, width: size.x }}>{t('pv.extraction')}</span>
            <Badge pos={{ left: '50%', top: 12, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{t('pv.infGoal', '2:41')}</Badge>
        </>
    );
};

export const HungerOverlay: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <Badge pos={{ left: 12, top: 12 }}>{t('pv.alive', '4 / 8')}</Badge>
        <Badge pos={{ right: 12, top: 12 }}>{t('pv.roundEnds', '3:12')}</Badge>
    </>
);
