// Character setup ("Hazard Bay" design): preset, name, parts and colors before a match.

import React, { useState } from 'react';
import { BODY_PRESETS } from '../../game/build/characterBases';
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
import { modalKey, StartCarry, useStartGate } from './account/useStartGate';
import { enterFullscreen, isTouchDevice } from '../fullscreen';
import { MenuScreenHeader } from '../menu/MenuScreenHeader';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-hazard';
const Chevron: React.FC<{ dir: 'l' | 'r' }> = ({ dir }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'l' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
);

// forTournament: opened from a tournament screen to pick a name; Start saves and goes back there, no match
interface Props { onContinue: () => void; onBack: () => void; onOpenProfile?: () => void; forTournament?: boolean }

const SetupScreen: React.FC<Props & { carry: StartCarry }> = ({ onContinue, onBack, onOpenProfile, forTournament = false, carry }) => {
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
        // The match reads the saved build when it starts; a changed look is also stamped for the cloud merge
        if (saveLookIfChanged({ build, skinId: preset.id, colors: { ...colors, player: colors.torso } })) notifyProgressChanged();
        actions.selectSkin(preset.id);
        actions.setPlayerCustomization(playerName, colors);
        if (!forTournament) actions.startGame(state.selectedMode);
        onContinue();
    };
    const gate = useStartGate(name, start, carry);
    const onStart = () => {
        // Hides the browser bar. It needs the tap's user activation, which a taken-name check that answers later would miss.
        if (isTouchDevice()) void enterFullscreen();
        gate.requestStart();
    };

    const mode = MODE_INFO[language][state.selectedMode].name;
    const mapLabel = t(state.selectedMap === MapId.TUNNELS ? 'hb.mapTunnels' : state.selectedMap === MapId.HUNGER ? 'hb.mapHunger' : 'hb.mapDefault').toLowerCase();
    const next = forTournament ? t('tournament.setup.next') : state.networkMode === NetworkMode.CLIENT ? t('cs.nextJoin')
        : t(state.networkMode === NetworkMode.HOST ? 'cs.nextHost' : 'cs.nextOffline', mode, mapLabel);
    const startLabel = forTournament ? t('tournament.setup.continue') : t(state.networkMode === NetworkMode.CLIENT ? 'cs.startJoin' : state.networkMode === NetworkMode.HOST ? 'cs.startHost' : 'cs.startOffline');
    const styleName = t(`cs.style.${preset.style}` as 'cs.style.human');
    const arrowClass = `ap-button flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded bg-bay-steel hover:bg-bay-plate phone:h-9 phone:w-9 ${focusRing}`;

    return (
        <div className="atompunk-ui h-viewport overflow-y-auto overflow-x-hidden bg-bay-ink font-body text-bay-chalk">
            {/* From lg up, and on a phone held sideways, the page fits the window: only the part tiles scroll, Start stays in view */}
            <div className="ap-page-shell mx-auto flex min-h-full max-w-[1440px] flex-col gap-7 px-4 pb-10 pt-8 sm:px-[72px] sm:pt-11 lg:h-full short:gap-5 short:pb-6 short:pt-5 phone:h-full phone:gap-2 phone:px-3 phone:pb-2 phone:pt-2">
                <MenuScreenHeader title={t('cs.title')} backLabel={t(forTournament ? 'cs.back' : 'cs.backToMenu')} onBack={onBack}>
                    {next}
                </MenuScreenHeader>

                <main className="grid flex-grow grid-cols-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_560px] lg:grid-rows-[minmax(0,1fr)] lg:items-start phone:min-h-0 phone:grid-cols-[minmax(0,230px)_minmax(0,1fr)] phone:grid-rows-[minmax(0,1fr)] phone:items-stretch phone:gap-3">
                    {/* Fixed-height preview that stays in view while the part tabs change height */}
                    <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 phone:static phone:min-h-0 phone:gap-1.5">
                        <CharacterPreview look={{ build, ...colors }} label={t('cs.preview')} badge={t('cs.skinCount', draft.presetIndex + 1, BODY_PRESETS.length)} />
                        <div className="flex items-center gap-4 phone:gap-2">
                            <button type="button" onClick={() => draft.stepPreset(-1)} aria-label={t('cs.prevSkin')} className={arrowClass}><Chevron dir="l" /></button>
                            <div className="flex min-w-0 flex-grow flex-col items-center gap-0.5 text-center">
                                <span className="flex flex-wrap items-baseline justify-center gap-x-2">
                                    <span className="font-display text-4xl font-black leading-none phone:text-lg">{t(`cs.base.${preset.body}`)}</span>
                                    {draft.changed && <span className="text-[15px] font-semibold text-bay-hazard phone:text-[11px]">{t('cs.changed')}</span>}
                                </span>
                                <span className="text-sm text-bay-dust phone:hidden">{t('cs.skinHint', styleName)}</span>
                            </div>
                            <button type="button" onClick={() => draft.stepPreset(1)} aria-label={t('cs.nextSkin')} className={arrowClass}><Chevron dir="r" /></button>
                        </div>
                        <XpBar xp={xp} />
                    </div>

                    <div className="flex min-w-0 flex-col gap-5 lg:h-full lg:min-h-0 short:gap-4 phone:h-full phone:min-h-0 phone:gap-2">
                        <NameField name={name} onName={setName} busy={gate.checking} nameProblem={gate.nameProblem} takenName={gate.takenName}
                            onOpenModal={gate.openModal} onOpenProfile={onOpenProfile} />

                        <BuilderTabs build={build} colors={colors} originals={draft.originals} level={levelForXp(xp)} onBuild={draft.patchBuild} onColor={draft.setColor} />

                        <div className="mt-auto flex shrink-0 gap-3">
                            <button type="button" onClick={onBack} className={`ap-button h-[72px] rounded border-2 border-bay-edge px-7 text-[17px] font-semibold hover:bg-bay-steel short:h-[60px] phone:hidden ${focusRing}`}>{t('cs.back')}</button>
                            <button type="button" onClick={onStart} disabled={gate.checking} className={`ap-button ap-primary ap-start h-[72px] flex-grow rounded bg-bay-hazard font-display text-[34px] font-black text-bay-ink hover:bg-[#FFD24D] disabled:cursor-wait disabled:opacity-70 short:h-[60px] short:text-[28px] phone:h-10 phone:text-xl ${focusRing}`}>{startLabel}</button>
                        </div>
                    </div>
                </main>
            </div>
            {gate.modal && <AccountModal key={modalKey(gate.modal)} initialTab={gate.modal.tab} initialNickname={gate.modal.nickname} notice={gate.modal.notice} onClose={gate.closeModal} />}
        </div>
    );
};

const CharacterSetup: React.FC<Props> = props => {
    const { nickname } = useAccount();
    // A Start still waiting for the accounts survives the screen being re-created by a restored login
    const [carry] = useState<StartCarry>(() => ({ pending: false }));
    // A login rewrites the saved look and XP under the screen: the editor starts over from what is saved now
    return <SetupScreen key={nickname ?? 'guest'} carry={carry} {...props} />;
};

export default CharacterSetup;
