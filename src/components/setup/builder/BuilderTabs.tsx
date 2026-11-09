// Tabbed part picker of the setup screen: head, body and jetpack parts as tiles, then all colours.

import React, { useEffect, useId, useRef, useState } from 'react';
import { FighterBuild, Slot } from '../../../game/build/buildParts';
import { TranslationKeys } from '../../../i18n/locales';
import { useTranslation } from '../../../i18n/useTranslation';
import { ColorRow } from '../ColorRow';
import { BodyColor, BodyPart, presetsFor } from '../colorPresets';
import { BadgeOptions } from './BadgeOptions';
import { PartTiles } from './PartTiles';
import { TABS, TabId } from './builderSlots';
import { usePartThumbnails } from './usePartThumbnails';

interface Props {
    build: FighterBuild;
    colors: Record<BodyColor, string>;
    /** The preset's own colours, which each row's reset button goes back to. */
    originals: Record<BodyPart, string>;
    level: number;
    onBuild: (patch: Partial<FighterBuild>) => void;
    onColor: (part: BodyColor, color: string) => void;
}

const BODY_COLORS: BodyColor[] = ['torso', 'head', 'arms', 'legs', 'jetpack'];
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bay-chalk';

/** A slot's tiles with their pictures; mounted only for the open tab, so only its pictures are drawn. */
const SlotTiles: React.FC<{ slot: Slot; build: FighterBuild; colors: Record<BodyColor, string>; level: number; onPick: (id: string) => void }> =
    ({ slot, build, colors, level, onPick }) => {
        const thumbs = usePartThumbnails(slot, build, colors);
        return <PartTiles slot={slot} value={build[slot]} level={level} thumbs={thumbs} onPick={onPick} />;
    };

export const BuilderTabs: React.FC<Props> = ({ build, colors, originals, level, onBuild, onColor }) => {
    const { t, language } = useTranslation();
    const [tab, setTab] = useState<TabId>('head');
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);
    const baseId = useId();
    const current = TABS.find(item => item.id === tab) ?? TABS[0];

    // On desktop the panel scrolls on its own: a newly opened tab starts at its first slot
    useEffect(() => {
        if (panelRef.current) panelRef.current.scrollTop = 0;
    }, [tab]);

    // Arrow keys move between tabs, as in a native tab strip
    const onTabKey = (e: React.KeyboardEvent, index: number) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = (index + step + TABS.length) % TABS.length;
        setTab(TABS[next].id);
        tabRefs.current[next]?.focus();
    };

    const colorRow = (part: BodyPart, label: string, value: string, onChange: (color: string) => void) => (
        <ColorRow key={part} label={label} groupLabel={t('cs.colorOf', label)} customLabel={t('cs.custom')}
            presets={presetsFor(part, language)} value={value} original={originals[part]} resetLabel={t('cs.resetColor', label)} onChange={onChange} />
    );
    const visorRow = colorRow('visor', t('cs.visor'), build.visorColor, color => onBuild({ visorColor: color }));
    const patternRow = colorRow('pattern', t('cs.pattern'), build.patternColor, color => onBuild({ patternColor: color }));
    const pick = (slot: Slot) => (id: string) => onBuild({ [slot]: id } as Partial<FighterBuild>);

    return (
        <div className="ap-panel ap-builder flex flex-col gap-4 rounded bg-bay-panel p-3 sm:p-5 lg:min-h-0 lg:flex-1 short:gap-3 short:p-4 phone:min-h-0 phone:flex-1 phone:gap-2 phone:p-2">
            <div role="tablist" aria-label={t('cs.tabs')} className="grid grid-cols-4 gap-1.5">
                {TABS.map((item, index) => {
                    const on = item.id === tab;
                    return (
                        <button key={item.id} ref={el => { tabRefs.current[index] = el; }} type="button" role="tab"
                            id={`${baseId}-tab-${item.id}`} aria-selected={on} aria-controls={`${baseId}-panel`} tabIndex={on ? 0 : -1}
                            onClick={() => setTab(item.id)} onKeyDown={e => onTabKey(e, index)}
                            className={`ap-button h-11 min-w-0 truncate rounded px-1 font-display text-base font-extrabold uppercase sm:text-xl sm:tracking-wide phone:h-7 phone:text-sm ${on ? 'bg-bay-hazard text-bay-ink' : 'bg-bay-steel text-bay-chalk hover:bg-bay-plate'} ${focusRing}`}>
                            {t(`cs.tab.${item.id}` as keyof TranslationKeys)}
                        </button>
                    );
                })}
            </div>

            {/* No scroll anchoring: tile pictures arriving late must not push the panel off its first slot */}
            <div ref={panelRef} role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}
                className="flex flex-col gap-4 [overflow-anchor:none] lg:-m-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-1 lg:pr-2 short:gap-3 phone:-m-1 phone:min-h-0 phone:flex-1 phone:gap-2 phone:overflow-y-auto phone:p-1 phone:pr-2">
                {current.slots.map(slot => (
                    <SlotTiles key={slot} slot={slot} build={build} colors={colors} level={level} onPick={pick(slot)} />
                ))}
                {tab === 'head' && <div className="-mb-2.5 -mt-1">{visorRow}</div>}
                {tab === 'body' && <BadgeOptions build={build} onBuild={onBuild} />}
                {tab === 'colours' && (
                    <div className="-my-2.5 flex flex-col">
                        {BODY_COLORS.map(part => colorRow(part, t(`cs.${part}` as keyof TranslationKeys), colors[part], color => onColor(part, color)))}
                        {patternRow}
                    </div>
                )}
            </div>
        </div>
    );
};
