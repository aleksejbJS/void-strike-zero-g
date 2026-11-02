import { describe, it, expect } from 'vitest';
import { Language, Team } from '../../types';
import { translations } from '../../i18n/locales';
import type { Translate } from '../menu/types';
import { FlagBannerEvent, flagBannerColor, flagBannerText } from './flagBannerText';

const tFor = (lang: Language) => ((key: keyof typeof translations.en, ...args: unknown[]) =>
    translations[lang][key].replace(/{(\d+)}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m))) as Translate;
const ev = (kind: FlagBannerEvent['kind'], action: FlagBannerEvent['action'], team = Team.NONE): FlagBannerEvent => ({ id: 'x', kind, action, team });

describe('flagBannerText', () => {
    it.each([
        [ev('ctf', 'grabbed', Team.RED), 'Red flag grabbed', 'Красный флаг взят'],
        [ev('ctf', 'lost', Team.BLUE), 'Blue flag lost', 'Синий флаг потерян'],
        [ev('ctf', 'returned', Team.RED), 'Red flag returned', 'Красный флаг возвращён'],
        [ev('ctf', 'captured', Team.BLUE), 'Blue captured the flag', 'Синие захватили флаг'],
        [ev('hold', 'grabbed', Team.BLUE), 'Blue has the flag', 'Синие взяли флаг'],
        [ev('hold', 'lost', Team.RED), 'Red lost the flag', 'Красные потеряли флаг'],
        [ev('intel', 'grabbed'), 'Intel grabbed', 'Разведданные взяты'],
        [ev('intel', 'lost'), 'Intel dropped', 'Разведданные потеряны'],
        [ev('intel', 'captured'), 'Intel extracted', 'Разведданные вывезены'],
    ])('%o reads "%s" / "%s"', (event, en, ru) => {
        expect(flagBannerText(tFor('en'), event)).toBe(en);
        expect(flagBannerText(tFor('ru'), event)).toBe(ru);
    });

    it('shows nothing for a team flag event without a team', () => {
        expect(flagBannerText(tFor('en'), ev('ctf', 'grabbed'))).toBeNull();
        expect(flagBannerText(tFor('en'), ev('hold', 'lost'))).toBeNull();
    });
});

describe('flagBannerColor', () => {
    it('follows the team, neutral and intel in hazard yellow', () => {
        const red = flagBannerColor(ev('ctf', 'grabbed', Team.RED));
        const blue = flagBannerColor(ev('ctf', 'captured', Team.BLUE));
        const intel = flagBannerColor(ev('intel', 'grabbed'));
        expect(new Set([red, blue, intel]).size).toBe(3);
        expect(intel).toBe('#FFC21A');
    });
});
