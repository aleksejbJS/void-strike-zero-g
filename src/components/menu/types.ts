// Shared types for menu components

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

export type Translate = ReturnType<typeof useTranslation>['t'];

/** Put React nodes into a translated template: fill('{0} fragged {1}', [<b>You</b>, <b>Bot</b>]). */
export const fill = (template: string, nodes: React.ReactNode[]): React.ReactNode[] =>
    template.split(/(\{\d+\})/).map((part, i) => {
        const slot = part.match(/^\{(\d+)\}$/);
        return slot ? React.createElement(React.Fragment, { key: i }, nodes[Number(slot[1])]) : part;
    });
