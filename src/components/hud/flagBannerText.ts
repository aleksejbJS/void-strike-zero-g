// What the objective banner says and in which colour: "RED FLAG GRABBED" in red, "BLUE CAPTURED
// THE FLAG" in blue, intel lines in hazard yellow. Pure, so both languages are easy to test.

import { Team } from '../../types';
import type { FlagAction, FlagKind } from '../../game/systems/events';
import type { Translate } from '../menu/types';

export interface FlagBannerEvent {
    id: string; // a new id restarts the banner even when the text repeats
    kind: FlagKind;
    action: FlagAction;
    team: Team;
}

const RED = '#F05252';
const BLUE = '#5B9BFF';
const NEUTRAL = '#FFC21A'; // bay-hazard

export const flagBannerColor = (b: FlagBannerEvent): string =>
    b.team === Team.RED ? RED : b.team === Team.BLUE ? BLUE : NEUTRAL;

/** The banner line, or null for an event that has nothing to show (no team where one is needed). */
export const flagBannerText = (t: Translate, b: FlagBannerEvent): string | null => {
    if (b.kind === 'intel') {
        if (b.action === 'grabbed') return t('hud.intelGrabbed');
        if (b.action === 'lost') return t('hud.intelLost');
        if (b.action === 'captured') return t('hud.intelCaptured');
        return null;
    }
    if (b.team === Team.NONE) return null;
    const red = b.team === Team.RED;
    const teamName = t(red ? 'hud.teamRed' : 'hud.teamBlue');
    if (b.kind === 'hold') {
        if (b.action === 'grabbed') return t('hud.holdGrabbed', teamName);
        if (b.action === 'lost') return t('hud.holdLost', teamName);
        return null;
    }
    const flagOf = t(red ? 'hud.flagOfRed' : 'hud.flagOfBlue');
    switch (b.action) {
        case 'grabbed': return t('hud.flagGrabbed', flagOf);
        case 'lost': return t('hud.flagLost', flagOf);
        case 'returned': return t('hud.flagReturned', flagOf);
        case 'captured': return t('hud.flagCaptured', teamName);
    }
};
