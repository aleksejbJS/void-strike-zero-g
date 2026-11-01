// Mode-specific HUD: Hunger Games status, betting and result; Gun Game ladder and winner.

import React from 'react';
import type { PlayerScore } from '../../store/uiStore';
import { PANEL } from './hudIcons';
import { formatClock } from './format';
import type { Translate } from '../menu/types';

export interface HungerHudState {
    credits: number;
    betTarget: string | null;
    winner: string | null;
    ended: boolean;
    timeUp: boolean;
    timeLeftSec: number | null;
    shrinkSec: number | null;
    restartSec: number | null;
    localDead: boolean;
    alive: { id: string; name: string }[];
    onBet: (id: string) => void;
}

export const HungerHud: React.FC<{ t: Translate; s: HungerHudState; ranking: PlayerScore[] }> = ({ t, s, ranking }) => (
    <>
        <div className={`${PANEL} pointer-events-none absolute left-1/2 top-6 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm`}>
            <span className="font-semibold text-lime-300">{t('hud.credits', s.credits)}</span>
            <span className="text-bay-dust">{s.betTarget ? t('hud.betPlaced', s.betTarget) : t('hud.betHint')}</span>
            {s.timeLeftSec !== null && !s.ended && <span className="font-semibold text-bay-hazard">{t('hud.roundEnds', formatClock(s.timeLeftSec))}</span>}
            {s.shrinkSec !== null && !s.ended && <span className="font-semibold text-lime-300">{t('hud.zoneShrinks', s.shrinkSec)}</span>}
        </div>

        {s.localDead && !s.betTarget && !s.ended && (
            <div className={`${PANEL} absolute bottom-[200px] left-1/2 z-50 w-[380px] max-w-[90vw] -translate-x-1/2 p-4`}>
                <div className="mb-2.5 font-display text-xl font-extrabold">{t('hud.placeBet')}</div>
                <div className="grid grid-cols-2 gap-2">
                    {s.alive.map(p => (
                        <button key={p.id} type="button" onClick={() => s.onBet(p.id)}
                            className="h-11 truncate rounded bg-bay-steel px-3 text-left text-sm font-semibold hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                            {p.name}
                        </button>
                    ))}
                    {s.alive.length === 0 && <div className="col-span-2 text-sm text-bay-dust">{t('hud.nobodyToBet')}</div>}
                </div>
            </div>
        )}

        {s.ended && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
                <div className={`${PANEL} flex w-[440px] max-w-[90vw] flex-col items-center gap-2 overflow-hidden pb-6`}>
                    <div aria-hidden="true" className="hazard-stripes h-3 w-full" />
                    {s.timeUp && <span className="mt-3 text-sm font-semibold text-bay-hazard">{t('hud.timeUp')}</span>}
                    <span className={`font-display text-4xl font-black ${s.timeUp ? '' : 'mt-4'}`}>{s.winner ? t('hud.winner', s.winner) : t('hud.noSurvivors')}</span>
                    {s.restartSec !== null && <span className="text-sm text-bay-dust">{t('hud.nextRound', s.restartSec)}</span>}
                    <div className="mt-2 w-full px-6">
                        <div className="mb-1 font-display text-lg font-extrabold">{t('hud.finalRanking')}</div>
                        <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
                            {ranking.map((p, i) => (
                                <li key={p.id} className="flex justify-between"><span className={i === 0 ? 'font-semibold text-bay-hazard' : ''}>{i + 1}. {p.name}</span><span>{p.score}</span></li>
                            ))}
                        </ol>
                    </div>
                </div>
            </div>
        )}
    </>
);

export interface GunGameStatus {
    weapon: string;
    level: number;
    total: number;
    progress: number;
    perLevel: number;
}

export const GunGameHud: React.FC<{ t: Translate; status: GunGameStatus | null; winner: string | null }> = ({ t, status, winner }) => (
    <>
        {status && (
            <div className={`${PANEL} pointer-events-none absolute left-1/2 top-6 z-40 flex w-[300px] -translate-x-1/2 flex-col gap-1.5 px-4 py-3`}>
                <div className="flex items-baseline justify-between">
                    <span className="font-display text-2xl font-black">{status.weapon}</span>
                    <span className="text-[13px] text-bay-dust">{t('hud.gunLevel', status.level, status.total)}</span>
                </div>
                <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${status.perLevel}, minmax(0, 1fr))` }}>
                    {Array.from({ length: status.perLevel }, (_, i) => <span key={i} className={`h-2 ${i < status.progress ? 'bg-bay-hazard' : 'bg-bay-plate'}`} />)}
                </div>
                <span className="text-[13px] text-bay-dust">{t('hud.gunKills', status.progress, status.perLevel)}</span>
            </div>
        )}
        {winner && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
                <div className={`${PANEL} flex flex-col items-center gap-2 overflow-hidden pb-6`}>
                    <div aria-hidden="true" className="hazard-stripes h-3 w-full" />
                    <span className="mt-4 px-8 font-display text-4xl font-black">{t('hud.winner', winner)}</span>
                    <span className="text-sm text-bay-dust">{t('hud.gunComplete')}</span>
                </div>
            </div>
        )}
    </>
);
