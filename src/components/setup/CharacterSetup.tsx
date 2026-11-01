// Character setup ("Hazard Bay" design): skin, name and colors before a match.

import React, { useEffect, useRef, useState } from 'react';
import { SKINS } from '../../constants';
import { MapId, NetworkMode } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from '../../i18n/useTranslation';
import { MODE_INFO } from '../menu/modeInfo';
import { CharacterPreview } from './CharacterPreview';
import { ColorRow } from './ColorRow';
import { BodyPart, presetsFor } from './colorPresets';

const MAX_NAME = 12;
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const Chevron: React.FC<{ dir: 'l' | 'r' }> = ({ dir }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'l' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
);

const CharacterSetup: React.FC<{ onContinue: () => void; onBack: () => void }> = ({ onContinue, onBack }) => {
    const { state, actions } = useUIStore();
    const { t, language } = useTranslation();
    const [name, setName] = useState(state.playerName);
    const [skinIndex, setSkinIndex] = useState(() => Math.max(0, SKINS.findIndex(s => s.id === state.selectedSkin)));
    const [colors, setColors] = useState<Record<BodyPart, string>>({
        torso: state.torsoColor || state.playerColor,
        head: state.headColor || state.playerColor,
        arms: state.armColor || state.playerColor,
        legs: state.legColor || '#475569',
        jetpack: state.jetpackColor || '#ef4444',
    });
    const skin = SKINS[skinIndex];

    // Functional update: rapid clicks each count
    const changeSkin = (step: number) => setSkinIndex(i => (i + step + SKINS.length) % SKINS.length);

    // A newly picked skin brings its own palette (not on mount: keep the saved colors)
    const shownSkin = useRef(skinIndex);
    useEffect(() => {
        if (shownSkin.current === skinIndex) return;
        shownSkin.current = skinIndex;
        const { palette } = SKINS[skinIndex];
        setColors({ torso: palette.torso, head: palette.head, arms: palette.arms, legs: palette.legs, jetpack: palette.jetpack });
    }, [skinIndex]);
    const setColor = (part: BodyPart) => (color: string) => setColors(c => ({ ...c, [part]: color }));

    const start = () => {
        actions.selectSkin(skin.id);
        actions.setPlayerCustomization(name.trim() || 'Anonymous', colors);
        actions.startGame(state.selectedMode);
        onContinue();
    };

    const mode = MODE_INFO[language][state.selectedMode].name;
    const mapLabel = t(state.selectedMap === MapId.TUNNELS ? 'hb.mapTunnels' : state.selectedMap === MapId.HUNGER ? 'hb.mapHunger' : 'hb.mapDefault').toLowerCase();
    const next = state.networkMode === NetworkMode.CLIENT ? t('cs.nextJoin')
        : t(state.networkMode === NetworkMode.HOST ? 'cs.nextHost' : 'cs.nextOffline', mode, mapLabel);
    const startLabel = t(state.networkMode === NetworkMode.CLIENT ? 'cs.startJoin' : state.networkMode === NetworkMode.HOST ? 'cs.startHost' : 'cs.startOffline');
    const parts: BodyPart[] = ['torso', 'head', 'arms', 'legs', 'jetpack'];
    const styleName = t(`cs.style.${skin.style}` as 'cs.style.human');

    return (
        <div className="h-screen overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            <div className="mx-auto flex min-h-full max-w-[1440px] flex-col gap-7 px-4 pb-10 pt-8 sm:px-[72px] sm:pt-11">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-2.5">
                        <button type="button" onClick={onBack} className={`flex items-center gap-1.5 self-start text-[15px] font-semibold text-bay-hazard hover:text-bay-chalk ${focusRing}`}>
                            <Chevron dir="l" />{t('cs.backToMenu')}
                        </button>
                        <h1 className="m-0 font-display text-[52px] font-black uppercase leading-[0.9] sm:text-[76px]">{t('cs.title')}</h1>
                    </div>
                    <span className="self-start rounded bg-bay-steel px-3.5 py-2.5 text-[15px] text-bay-dust sm:self-auto">{next}</span>
                </header>
                <div aria-hidden="true" className="hazard-stripes -mx-4 -mt-3 h-3.5 sm:-mx-[72px]" />

                <main className="grid flex-grow grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_560px]">
                    <div className="flex min-w-0 flex-col gap-4">
                        <CharacterPreview look={{ skin, ...colors }} label={t('cs.preview')} badge={t('cs.skinCount', skinIndex + 1, SKINS.length)} />
                        <div className="flex items-center gap-4">
                            <button type="button" onClick={() => changeSkin(-1)} aria-label={t('cs.prevSkin')} className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded bg-bay-steel hover:bg-bay-plate ${focusRing}`}><Chevron dir="l" /></button>
                            <div className="flex flex-grow flex-col items-center gap-0.5 text-center">
                                <span className="font-display text-4xl font-black leading-none">{skin.name}</span>
                                <span className="text-sm text-bay-dust">{t('cs.skinHint', styleName)}</span>
                            </div>
                            <button type="button" onClick={() => changeSkin(1)} aria-label={t('cs.nextSkin')} className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded bg-bay-steel hover:bg-bay-plate ${focusRing}`}><Chevron dir="r" /></button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="setup-name" className="font-display text-2xl font-extrabold">{t('cs.name')}</label>
                            <input id="setup-name" value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value.slice(0, MAX_NAME))}
                                className="h-[54px] rounded border-2 border-bay-edge bg-bay-panel px-4 text-xl font-semibold text-bay-chalk focus:border-bay-hazard focus:outline-none" />
                            <span className="text-[13px] text-bay-dust">{t('cs.nameHint', name.length, MAX_NAME)}</span>
                        </div>

                        <div className="flex flex-col rounded bg-bay-panel px-5 py-1.5">
                            {parts.map(part => (
                                <ColorRow key={part} label={t(`cs.${part}` as 'cs.torso')} groupLabel={t('cs.colorOf', t(`cs.${part}` as 'cs.torso'))}
                                    customLabel={t('cs.custom')} presets={presetsFor(part, language)} value={colors[part]} onChange={setColor(part)} />
                            ))}
                        </div>

                        <div className="mt-auto flex gap-3">
                            <button type="button" onClick={onBack} className={`h-[72px] rounded border-2 border-bay-edge px-7 text-[17px] font-semibold hover:bg-bay-steel ${focusRing}`}>{t('cs.back')}</button>
                            <button type="button" onClick={start} className={`h-[72px] flex-grow rounded bg-bay-hazard font-display text-[34px] font-black text-bay-ink hover:bg-[#FFD24D] ${focusRing}`}>{startLabel}</button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CharacterSetup;
