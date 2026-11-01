// Results screen at the end of a score/time-limited match; the next match starts by itself.

import React from 'react';
import type { PlayerScore } from '../../store/uiStore';
import type { MatchHud } from './matchHud';
import { PANEL } from './hudIcons';
import type { Translate } from '../menu/types';

interface Props {
    t: Translate;
    result: NonNullable<MatchHud['result']>;
    ranking: PlayerScore[];
    onLeave: () => void;
}

export const MatchResult: React.FC<Props> = ({ t, result, ranking, onLeave }) => (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-[rgba(14,17,22,0.7)]">
        <div role="dialog" aria-labelledby="match-result-title" className={`${PANEL} flex w-[480px] max-w-[92vw] flex-col items-center overflow-hidden pb-6`}>
            <div aria-hidden="true" className="hazard-stripes h-3.5 w-full" />
            <span className="mt-5 text-sm font-semibold text-bay-hazard">{result.reason}</span>
            <h2 id="match-result-title" className="m-0 mt-1 px-6 text-center font-display text-5xl font-black leading-none">{result.title}</h2>

            {result.teams && (
                <div className="mt-4 flex overflow-hidden rounded font-display text-5xl font-black">
                    <span className="bg-[#1E3A8A] px-6 py-1.5">{result.teams.blue}</span>
                    <span className="bg-[#7F1D1D] px-6 py-1.5">{result.teams.red}</span>
                </div>
            )}

            <div className="mt-5 w-full px-7">
                <div className="mb-1 font-display text-lg font-extrabold">{t('match.ranking')}</div>
                <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-[15px]">
                    {ranking.slice(0, 6).map((p, i) => (
                        <li key={p.id} className="flex justify-between">
                            <span className={p.isLocal ? 'font-semibold text-bay-hazard' : ''}>{i + 1}. {p.name}</span>
                            <span className="tabular-nums">{p.score}</span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="mt-6 flex w-full items-center justify-between gap-4 px-7">
                <span className="text-sm text-bay-dust">{t('match.next', result.restartSec)}</span>
                <button type="button" onClick={onLeave}
                    className="h-12 rounded border-2 border-bay-chalk px-5 font-semibold hover:bg-bay-chalk hover:text-bay-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                    {t('match.toMenu')}
                </button>
            </div>
        </div>
    </div>
);
