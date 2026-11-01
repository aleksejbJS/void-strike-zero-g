// Score-related HUD: free-for-all scoreboard (top left), team score with objective hint
// (top center) and the kill feed (top right).

import React from 'react';
import { KillMessage } from '../../types';
import type { PlayerScore } from '../../store/uiStore';
import { PANEL } from './hudIcons';
import type { Translate } from '../menu/types';

export const Scoreboard: React.FC<{ t: Translate; players: PlayerScore[]; gunLadder?: { total: number; perLevel: number } }> = ({ t, players, gunLadder }) => (
    <div className={`${PANEL} pointer-events-none absolute left-8 top-7 z-40 flex w-[260px] flex-col gap-1.5 px-3.5 py-3`}>
        <span className="font-display text-xl font-extrabold">{t('hud.scoreboard')}</span>
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
            {players.map((p, i) => (
                <li key={p.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
                    <span className="text-bay-dust">{i + 1}</span>
                    <span className={`truncate ${p.isLocal ? 'font-semibold text-bay-hazard' : ''}`}>{p.name}{p.isLocal ? ` ${t('hud.you')}` : ''}</span>
                    <span className="text-right font-semibold tabular-nums">
                        {p.score}
                        {gunLadder && <span className="block text-[11px] font-normal text-bay-dust">{(p.gunLevel ?? 0) + 1}/{gunLadder.total} · {p.gunProgress ?? 0}/{gunLadder.perLevel}</span>}
                    </span>
                </li>
            ))}
        </ol>
    </div>
);

export const TeamScore: React.FC<{ t: Translate; blue: number; red: number; objective: string | null; timer?: string }> = ({ t, blue, red, objective, timer }) => (
    <div className="pointer-events-none absolute left-1/2 top-6 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex overflow-hidden rounded">
            <div className="flex items-baseline gap-2.5 bg-[#1E3A8A] px-5 py-1.5">
                <span className="text-[15px] font-semibold text-blue-200">{t('pv.blue')}</span>
                <span className="font-display text-[40px] font-black leading-none">{blue}</span>
            </div>
            <div className="flex items-baseline gap-2.5 bg-[#7F1D1D] px-5 py-1.5">
                <span className="font-display text-[40px] font-black leading-none">{red}</span>
                <span className="text-[15px] font-semibold text-red-200">{t('pv.red')}</span>
            </div>
            {timer && <div className="flex items-center bg-bay-ink/90 px-3 font-display text-2xl font-black text-bay-hazard">{timer}</div>}
        </div>
        {objective && <span className={`${PANEL} px-3 py-1.5 text-[15px]`}>{objective}</span>}
    </div>
);

export const KillFeed: React.FC<{ kills: KillMessage[] }> = ({ kills }) => (
    <div className="pointer-events-none flex flex-col items-end gap-1 text-sm">
        {kills.map(k => (
            <span key={k.id} className={`${PANEL} px-2.5 py-1`}>
                <b style={{ color: k.killerColor }}>{k.killer}</b>{' '}
                <span className="text-bay-dust">{k.weapon.toLowerCase()}</span>{' '}
                <b style={{ color: k.victimColor }}>{k.victim}</b>
            </span>
        ))}
    </div>
);
