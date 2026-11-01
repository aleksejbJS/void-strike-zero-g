// "What's new" side panel with the release history (opened from the menu header)

import React, { useEffect, useRef } from 'react';
import { PatchNote } from './patchNotes';
import type { Translate } from './types';

interface Props {
    t: Translate;
    notes: PatchNote[];
    onClose: () => void;
}

export const WhatsNew: React.FC<Props> = ({ t, notes, onClose }) => {
    const closeButton = useRef<HTMLButtonElement>(null);

    // Focus the panel on open; Esc closes it
    useEffect(() => {
        closeButton.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(10,12,15,0.6)]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={e => e.stopPropagation()}
                className="flex h-full w-full max-w-[480px] flex-col bg-bay-panel text-bay-chalk">
                <div aria-hidden="true" className="hazard-stripes h-3.5 shrink-0" />
                <div className="flex items-center justify-between px-7 pb-2 pt-6">
                    <h2 id="whats-new-title" className="m-0 font-display text-[44px] font-black leading-none">{t('hb.whatsNew')}</h2>
                    <button ref={closeButton} type="button" onClick={onClose} aria-label={t('hb.close')}
                        className="flex h-11 w-11 items-center justify-center rounded bg-bay-steel hover:bg-bay-plate focus-visible:outline focus-visible:outline-2 focus-visible:outline-bay-hazard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>
                <div className="flex flex-grow flex-col gap-[22px] overflow-y-auto px-7 pb-7 pt-2">
                    {notes.map((note, i) => (
                        <section key={note.version} className="flex flex-col gap-2">
                            <div className="flex items-baseline gap-2.5">
                                <h3 className={`m-0 font-display text-[28px] font-black ${i === 0 ? 'text-bay-hazard' : ''}`}>{note.version}</h3>
                                <span className="text-sm text-bay-dust">{note.date ?? t('hb.thisUpdate')}</span>
                            </div>
                            <ul className={`m-0 flex list-disc flex-col gap-1.5 pl-[18px] marker:text-bay-hazard text-[15px] leading-snug ${i === 0 ? '' : 'text-[#D6D2CA]'}`}>
                                {note.points.map(point => <li key={point}>{point}</li>)}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};
