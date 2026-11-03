// Character setup ("Hazard Bay" design): preset, name, parts and colors before a match.

import React, { useState } from 'react';
import { SKINS } from '../../constants';
import { MapId, NetworkMode } from '../../types';
import { saveLookIfChanged } from '../../account/localSnapshot';
import { notifyProgressChanged } from '../../account/progressEvents';
import { useAccount } from '../../account/useAccount';
import { loadXp } from '../../game/build/progress';
import { levelForXp } from '../../game/build/unlocks';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from '../../i18n/useTranslation';
import { MODE_INFO } from '../menu/modeInfo';
import { CharacterPreview } from './CharacterPreview';
import { BuilderTabs } from './builder/BuilderTabs';
import { XpBar } from './builder/XpBar';
import { useFighterDraft } from './builder/useFighterDraft';
import { AccountModal } from './account/AccountModal';
import { NameField } from './account/NameField';
import { useStartGate } from './account/useStartGate';
import { enterFullscreen, isTouchDevice } from '../fullscreen';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const Chevron: React.FC<{ dir: 'l' | 'r' }> = ({ dir }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'l' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
);

interface Props { onContinue: () => void; onBack: () => void; onOpenProfile?: () => void }

const SetupScreen: React.FC<Props> = ({ onContinue, onBack, onOpenProfile }) => {
    const { state, actions } = useUIStore();
    const { t, language } = useTranslation();
    const [name, setName] = useState(state.playerName);
    const [xp] = useState(loadXp);
    const draft = useFighterDraft(state.selectedSkin, {
        torso: state.torsoColor || state.playerColor,
        head: state.headColor || state.playerColor,
        arms: state.armColor || state.playerColor,
        legs: state.legColor || '#475569',
        jetpack: state.jetpackColor || '#ef4444',
    });
    const { preset, build, colors } = draft;

    const start = (playerName: string) => {
        if (isTouchDevice()) void enterFullscreen(); // hides the browser bar; needs this tap
        // The match reads the saved build when it starts; a changed look is also stamped for the cloud merge
        if (saveLookIfChanged({ build, skinId: preset.id, colors: { ...colors, player: colors.torso } })) notifyProgressChanged();
        actions.selectSkin(preset.id);
        actions.setPlayerCustomization(playerName, colors);
        actions.startGame(state.selectedMode);
        onContinue();
    };
    const gate = useStartGate(name, start);

    const mode = MODE_INFO[language][state.selectedMode].name;
    const mapLabel = t(state.selectedMap === MapId.TUNNELS ? 'hb.mapTunnels' : state.selectedMap === MapId.HUNGER ? 'hb.mapHunger' : 'hb.mapDefault').toLowerCase();
    const next = state.networkMode === NetworkMode.CLIENT ? t('cs.nextJoin')
        : t(state.networkMode === NetworkMode.HOST ? 'cs.nextHost' : 'cs.nextOffline', mode, mapLabel);
    const startLabel = t(state.networkMode === NetworkMode.CLIENT ? 'cs.startJoin' : state.networkMode === NetworkMode.HOST ? 'cs.startHost' : 'cs.startOffline');
    const styleName = t(`cs.style.${preset.style}` as 'cs.style.human');
    const arrowClass = `flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded bg-bay-steel hover:bg-bay-plate phone:h-9 phone:w-9 ${focusRing}`;

    return (
        <div className="h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            {/* From lg up, and on a phone held sideways, the page fits the window: only the part tiles scroll, Start stays in view */}
            <div className="mx-auto flex min-h-full max-w-[1440px] flex-col gap-7 px-4 pb-10 pt-8 sm:px-[72px] sm:pt-11 lg:h-full short:gap-5 short:pb-6 short:pt-5 phone:h-full phone:gap-2 phone:px-3 phone:pb-2 phone:pt-2">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between phone:flex-row phone:items-center">
                    <div className="flex flex-col gap-2.5 phone:flex-row phone:items-center phone:gap-4">
                        <button type="button" onClick={onBack} className={`flex items-center gap-1.5 self-start text-[15px] font-semibold text-bay-hazard hover:text-bay-chalk ${focusRing}`}>
                            <Chevron dir="l" />{t('cs.backToMenu')}
                        </button>
                        <h1 className="m-0 font-display text-[52px] font-black uppercase leading-[0.9] sm:text-[76px] short:text-[56px] phone:text-2xl">{t('cs.title')}</h1>
                    </div>
                    <span className="self-start rounded bg-bay-steel px-3.5 py-2.5 text-[15px] text-bay-dust sm:self-auto phone:self-auto phone:px-2 phone:py-1 phone:text-xs">{next}</span>
                </header>
                <div aria-hidden="true" className="hazard-stripes -mx-4 -mt-3 h-3.5 sm:-mx-[72px] phone:hidden" />

                <main className="grid flex-grow grid-cols-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_560px] lg:grid-rows-[minmax(0,1fr)] lg:items-start phone:min-h-0 phone:grid-cols-[minmax(0,230px)_minmax(0,1fr)] phone:grid-rows-[minmax(0,1fr)] phone:items-stretch phone:gap-3">
                    {/* Fixed-height preview that stays in view while the part tabs change height */}
                    <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 phone:static phone:min-h-0 phone:gap-1.5">
                        <CharacterPreview look={{ build, ...colors }} label={t('cs.preview')} badge={t('cs.skinCount', draft.presetIndex + 1, SKINS.length)} />
                        <div className="flex items-center gap-4 phone:gap-2">
                            <button type="button" onClick={() => draft.stepPreset(-1)} aria-label={t('cs.prevSkin')} className={arrowClass}><Chevron dir="l" /></button>
                            <div className="flex min-w-0 flex-grow flex-col items-center gap-0.5 text-center">
                                <span className="flex flex-wrap items-baseline justify-center gap-x-2">
                                    <span className="font-display text-4xl font-black leading-none phone:text-lg">{preset.name}</span>
                                    {draft.changed && <span className="text-[15px] font-semibold text-bay-hazard phone:text-[11px]">{t('cs.changed')}</span>}
                                </span>
                                <span className="text-sm text-bay-dust phone:hidden">{t('cs.skinHint', styleName)}</span>
                            </div>
                            <button type="button" onClick={() => draft.stepPreset(1)} aria-label={t('cs.nextSkin')} className={arrowClass}><Chevron dir="r" /></button>
                        </div>
                        <XpBar xp={xp} />
                    </div>

                    <div className="flex min-w-0 flex-col gap-5 lg:h-full lg:min-h-0 short:gap-4 phone:h-full phone:min-h-0 phone:gap-2">
                        <NameField name={name} onName={setName} busy={gate.checking} takenName={gate.takenName}
                            onOpenModal={gate.openModal} onOpenProfile={onOpenProfile} />

                        <BuilderTabs build={build} colors={colors} level={levelForXp(xp)} onBuild={draft.patchBuild} onColor={draft.setColor} />

                        <div className="mt-auto flex shrink-0 gap-3">
                            <button type="button" onClick={onBack} className={`h-[72px] rounded border-2 border-bay-edge px-7 text-[17px] font-semibold hover:bg-bay-steel short:h-[60px] phone:hidden ${focusRing}`}>{t('cs.back')}</button>
                            <button type="button" onClick={gate.requestStart} disabled={gate.checking} className={`h-[72px] flex-grow rounded bg-bay-hazard font-display text-[34px] font-black text-bay-ink hover:bg-[#FFD24D] disabled:cursor-wait disabled:opacity-70 short:h-[60px] short:text-[28px] phone:h-10 phone:text-xl ${focusRing}`}>{startLabel}</button>
                        </div>
                    </div>
                </main>
            </div>
            {gate.modal && <AccountModal initialTab={gate.modal.tab} initialNickname={gate.modal.nickname} onClose={gate.closeModal} />}
        </div>
    );
};

const CharacterSetup: React.FC<Props> = props => {
    const { nickname } = useAccount();
    // A login rewrites the saved look and XP under the screen: the editor starts over from what is saved now
    return <SetupScreen key={nickname ?? 'guest'} {...props} />;
};

export default CharacterSetup;
