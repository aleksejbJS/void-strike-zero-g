// One ad place on the admin page: what and where it is, the spot code, and a live test.

import React, { useMemo, useState } from 'react';
import { AdPlaceConfig, looksLikeTrafficStars } from '../../game/ads/adConfig';
import { houseAds } from '../../game/render/scene/houseAds';
import { PlaceInfo } from './adsDraft';
import { BannerTest } from './BannerTest';

interface Props {
    info: PlaceInfo;
    cfg: AdPlaceConfig;
    onChange: (cfg: AdPlaceConfig) => void;
}

export const AdPlaceCard: React.FC<Props> = ({ info, cfg, onChange }) => {
    const [testRun, setTestRun] = useState(0);
    const housePoster = useMemo(() => houseAds()[info.size][0].toDataURL(), [info.size]);
    const code = cfg.code.trim();
    const codeId = `code-${info.id}`;
    const warning = !code
        ? 'Код не задан — здесь висит наш плакат.'
        : !looksLikeTrafficStars(code)
            ? 'Код не похож на код спота TrafficStars. Проверьте, что скопировали его целиком.'
            : null;

    return (
        <section className="ap-panel ap-ad-card flex flex-col gap-3 rounded border-2 border-bay-steel bg-bay-panel p-4" aria-labelledby={`title-${info.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                    <h2 id={`title-${info.id}`} className="m-0 font-display text-2xl font-black leading-tight">{info.name}</h2>
                    <span className="text-sm text-bay-dust">{info.where}</span>
                    <span className="mt-1 text-sm">Размер спота: <b className="tabular-nums">{info.size.replace('x', '×')}</b> · id <code className="text-bay-dust">{info.id}</code></span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={cfg.enabled} disabled={!code}
                        onChange={e => onChange({ ...cfg, enabled: e.target.checked })}
                        className="h-5 w-5 accent-[#FFC21A]" />
                    Показывать рекламу
                </label>
            </div>

            <div className="flex flex-wrap items-start gap-4">
                <figure className="m-0 flex flex-col gap-1">
                    <img src={housePoster} alt="Наш плакат на этом месте" className="h-16 w-auto rounded-sm border border-bay-steel" />
                    <figcaption className="text-xs text-bay-dust">Наш плакат, если рекламы нет</figcaption>
                </figure>
                <div className="flex min-w-0 basis-[240px] flex-1 flex-col gap-1">
                    <label htmlFor={codeId} className="text-sm font-semibold">Код спота TrafficStars</label>
                    <textarea id={codeId} value={cfg.code} rows={4} spellCheck={false}
                        placeholder="Вставьте сюда код спота из кабинета TrafficStars"
                        onChange={e => onChange({ ...cfg, code: e.target.value, enabled: cfg.enabled && e.target.value.trim() !== '' })}
                        className="w-full rounded border-2 border-bay-plate bg-bay-ink p-2 font-mono text-xs text-bay-chalk focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard" />
                    {warning && <span className="text-sm text-bay-hazard">{warning}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <button type="button" disabled={!code} onClick={() => setTestRun(n => n + 1)}
                    className="ap-button self-start rounded border-2 border-bay-plate bg-bay-steel px-4 py-2 font-semibold hover:bg-bay-plate disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                    {testRun ? 'Проверить ещё раз' : 'Проверить спот'}
                </button>
                {testRun > 0 && code && <BannerTest key={testRun} code={code} size={info.size} kind={info.kind} />}
            </div>
        </section>
    );
};
