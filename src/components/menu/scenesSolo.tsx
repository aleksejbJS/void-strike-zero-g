// Schematic previews for free-for-all modes: Deathmatch, Gun Game, Hunger Games

import React, { useEffect, useState } from 'react';
import { Badge, COLORS, Figure, Pop, Tracer } from './previewParts';
import { fill, Translate } from './types';

export const DeathmatchScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <Figure x={100} y={164} body={COLORS.you} label={t('pv.you')} flame animation="hb-fly-a 5s ease-in-out infinite" />
        <Tracer x={130} y={200} color={COLORS.hazard} dir="r" duration="1.1s" />
        <Figure x={470} y={180} body={COLORS.red} head={COLORS.redHead} animation="hb-bob 2.2s ease-in-out infinite" />
        <Tracer x={450} y={192} color="#FF8F78" dir="l" duration="1.4s" delay="0.4s" />
        <Figure x={300} y={100} body={COLORS.blue} flame animation="hb-fly-b 4.4s ease-in-out infinite" />
        <Figure x={520} y={266} body={COLORS.green} />
        <Pop x={150} y={150} text="+1" duration="2.4s" />
        <DeathmatchOverlay t={t} />
    </>
);

/** Texts over the Deathmatch preview, shared by the schematic and the live scene. */
export const DeathmatchOverlay: React.FC<{ t: Translate }> = ({ t }) => (
    <Badge pos={{ right: 12, top: 12 }}>
        {fill(t('pv.killLine'), [<b className="text-bay-hazard">{t('pv.you')}</b>, <b className="text-[#FF8F78]">Bot 2</b>])}
    </Badge>
);

export const LADDER_KEYS = ['weapon.machineGun', 'weapon.shotgun', 'weapon.grenadeLauncher', 'weapon.rocketLauncher', 'weapon.plasmaGun', 'weapon.railgun'] as const;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const GunGameScene: React.FC<{ t: Translate }> = ({ t }) => {
    // The highlight climbs the ladder like a player upgrading
    const [step, setStep] = useState(0);
    useEffect(() => {
        if (prefersReducedMotion()) return;
        const id = setInterval(() => setStep(s => (s + 1) % LADDER_KEYS.length), 1200);
        return () => clearInterval(id);
    }, []);

    return (
        <>
            <div className="absolute inset-x-2 top-2.5 grid grid-cols-6 gap-1">
                {LADDER_KEYS.map((key, i) => (
                    <span key={key} className={`flex h-[34px] items-center justify-center rounded-sm px-1 text-center text-[11px] font-semibold leading-tight ${i === step ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk'}`}>
                        {t(key)}
                    </span>
                ))}
            </div>
            <Badge pos={{ left: 8, top: 52 }}>{t('pv.killsThisWeapon', '3 / 5')}</Badge>
            <Figure x={100} y={164} body={COLORS.you} label={t('pv.you')} animation="hb-bob 2s ease-in-out infinite" />
            <Tracer x={130} y={200} color={COLORS.hazard} dir="r" duration="0.9s" />
            <Figure x={470} y={180} body={COLORS.red} head={COLORS.redHead} flame animation="hb-fly-b 4s ease-in-out infinite" />
            <Pop x={140} y={150} text={t('pv.upgrade')} duration="3s" />
        </>
    );
};

export const HungerScene: React.FC<{ t: Translate }> = ({ t }) => (
    <>
        <div className="hb-anim absolute rounded border-2 border-dashed border-lime-400"
            style={{ inset: 20, boxShadow: '0 0 0 600px rgba(255, 77, 46, 0.16)', animation: 'hb-shrink 8s ease-in-out infinite alternate' }} />
        <Figure x={110} y={180} body={COLORS.you} />
        <Figure x={290} y={100} body={COLORS.green} animation="hb-bob 2.4s ease-in-out infinite" />
        <Figure x={470} y={180} body={COLORS.red} head={COLORS.redHead} />
        <Figure x={330} y={266} body={COLORS.blue} />
        <Badge pos={{ left: 12, top: 12 }}>{t('pv.alive', '4 / 8')}</Badge>
        <Badge pos={{ right: 12, top: 12 }}>{t('pv.roundEnds', '3:12')}</Badge>
    </>
);
