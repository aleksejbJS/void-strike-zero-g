// Hidden admin page (#ads-admin): set up TrafficStars spots for the in-world ad places and
// download ads.json to deploy. It edits a draft in this browser only; nothing is sent anywhere.

import React, { useEffect, useRef, useState } from 'react';
import { AdConfig, AdPlaceConfig, loadAdConfig } from '../../game/ads/adConfig';
import { AD_PLACES, clearDraft, loadDraft, newConfig, parseConfigText, saveDraft, serialize, withAllPlaces } from './adsDraft';
import { AdPlaceCard } from './AdPlaceCard';
import { MenuScreenHeader } from '../menu/MenuScreenHeader';

const BUTTON = 'ap-button rounded border-2 px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard';

export const AdsAdmin: React.FC = () => {
    const [config, setConfig] = useState<AdConfig>(() => loadDraft() ?? newConfig());
    const [notice, setNotice] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const hadDraft = useRef(loadDraft() !== null);

    // No draft yet: start from the ads.json that is live now
    useEffect(() => {
        if (hadDraft.current) return;
        fetch(new URL('ads.json', document.baseURI).href, { cache: 'no-cache' })
            .then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(text => { const parsed = parseConfigText(text); if ('config' in parsed) setConfig(parsed.config); })
            .catch(err => console.warn('Ads admin: no ads.json to start from', err));
    }, []);

    useEffect(() => saveDraft(config), [config]);

    const updatePlace = (id: string, cfg: AdPlaceConfig) => setConfig(c => ({ ...c, places: { ...c.places, [id]: cfg } }));

    const download = () => {
        const url = URL.createObjectURL(new Blob([serialize(config)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'ads.json'; a.click();
        URL.revokeObjectURL(url);
        setNotice('Файл ads.json скачан. Положите его в папку public/ проекта и выложите новую версию игры.');
    };

    const upload = async (file: File) => {
        const parsed = parseConfigText(await file.text());
        if ('error' in parsed) { setNotice(`Не удалось открыть файл: ${parsed.error}`); return; }
        setConfig(parsed.config);
        setNotice(`Загружен ${file.name}.`);
    };

    const reset = async () => {
        clearDraft();
        setConfig(withAllPlaces(await loadAdConfig(new URL('ads.json', document.baseURI).href)));
        setNotice('Черновик сброшен к опубликованному ads.json.');
    };

    const active = AD_PLACES.filter(p => config.places[p.id]?.enabled).length;

    // The game turns off page scrolling (body overflow: hidden), so this page scrolls itself
    return (
        <main className="atompunk-ui h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="ap-page-shell ap-narrow-shell mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
                <MenuScreenHeader title="Реклама на картах" backLabel="Вернуться в игру" backHref="#" />
                <div className="ap-panel flex flex-col gap-3 p-5">
                    <p className="m-0 max-w-[66ch] text-bay-dust">
                        Каждое место на карте — отдельный спот TrafficStars. Вставьте код спота нужного размера, проверьте его и скачайте ads.json.
                        Черновик хранится только в этом браузере; игроки увидят изменения после того, как файл окажется в <code>public/ads.json</code> и игра будет выложена заново.
                    </p>
                    <p className="m-0 text-sm">Включено мест: <b>{active}</b> из {AD_PLACES.length}</p>
                </div>

                <div className="ap-panel ap-ads-toolbar flex flex-wrap items-end gap-3">
                    <button type="button" onClick={download} className={`${BUTTON} ap-primary border-bay-hazard bg-bay-hazard text-bay-ink hover:brightness-110`}>Скачать ads.json</button>
                    <button type="button" onClick={() => fileInput.current?.click()} className={`${BUTTON} border-bay-plate bg-bay-steel hover:bg-bay-plate`}>Загрузить ads.json</button>
                    <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) upload(f).catch(err => setNotice(`Не удалось прочитать файл: ${(err as Error).message}`));
                            e.target.value = '';
                        }} />
                    <button type="button" onClick={reset} className={`${BUTTON} border-bay-plate bg-transparent hover:bg-bay-steel`}>Сбросить черновик</button>
                    <label className="flex items-center gap-2 text-sm">
                        Обновлять баннер не чаще, чем раз в
                        <input type="number" min={30} step={10} value={config.refreshSec}
                            onChange={e => setConfig(c => ({ ...c, refreshSec: Math.max(30, Number(e.target.value) || 60) }))}
                            className="w-20 rounded border-2 border-bay-plate bg-bay-ink px-2 py-1 tabular-nums" />
                        с
                    </label>
                </div>
                {notice && <p role="status" className="ap-notice m-0 rounded bg-bay-steel px-3 py-2 text-sm">{notice}</p>}

                {AD_PLACES.map(info => (
                    <AdPlaceCard key={info.id} info={info} cfg={config.places[info.id]} onChange={cfg => updatePlace(info.id, cfg)} />
                ))}

                <a href="#" className="ap-button ap-screen-back self-start text-sm text-bay-dust underline hover:text-bay-chalk">← Вернуться в игру</a>
            </div>
        </main>
    );
};
