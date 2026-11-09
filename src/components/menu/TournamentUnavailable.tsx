import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useModalLayer } from '../useModalLayer';

/** Keeps the menu entry discoverable when this build has no tournament service. */
export const TournamentUnavailable: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const layer = useRef<HTMLDivElement>(null);
    const close = useRef<HTMLButtonElement>(null);
    const title = useId();
    useModalLayer(layer, onClose);
    useEffect(() => { close.current?.focus(); }, []);
    return (
        <div ref={layer} className="atompunk-ui ap-modal-layer fixed inset-0 z-50 flex items-center justify-center p-4">
            <section role="dialog" aria-modal="true" aria-labelledby={title} className="ap-panel ap-dialog flex max-h-full w-full flex-col gap-5 overflow-y-auto">
                <h2 id={title} className="m-0 font-display text-3xl font-extrabold uppercase">{t('tournament.menu')}</h2>
                <p className="m-0 text-bay-dust">{t('tournament.error.offline')}</p>
                <button ref={close} type="button" onClick={onClose} className="ap-button ap-primary self-start px-5 py-2">
                    {t('hb.close')}
                </button>
            </section>
        </div>
    );
};
