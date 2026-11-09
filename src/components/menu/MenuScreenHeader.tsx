import React from 'react';
import { assetUrl } from '../../assetUrl';

interface Props {
    title: string;
    backLabel: string;
    onBack?: () => void;
    backHref?: string;
    titleAs?: 'h1' | 'h2';
    children?: React.ReactNode;
}

/** Compact edition of the main menu's logo and riveted metal header. */
export const MenuScreenHeader: React.FC<Props> = ({ title, backLabel, onBack, backHref, titleAs: Heading = 'h1', children }) => {
    const backContent = <><span aria-hidden="true">‹</span>{backLabel}</>;
    const backClass = 'ap-button ap-screen-back';
    return (
        <header className="ap-panel ap-screen-header">
            <div className="ap-screen-logo">
                <img src={assetUrl('assets/menu/void-strike-logo.webp')} alt="Void Strike: Zero-G" width="2172" height="724" />
            </div>
            <Heading className="ap-screen-title">{title}</Heading>
            {backHref ? <a href={backHref} className={backClass}>{backContent}</a> : (
                <button type="button" onClick={onBack} className={backClass}>{backContent}</button>
            )}
            {children && <div className="ap-screen-meta">{children}</div>}
        </header>
    );
};
