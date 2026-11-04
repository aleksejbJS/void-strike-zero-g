import { describe, it, expect } from 'vitest';
import { translations } from '../../i18n/locales';
import type { Translate } from '../menu/types';
import { weaponLabel } from './weaponLabel';

const tIn = (lang: 'en' | 'ru') => ((key: keyof typeof translations['en']) => translations[lang][key]) as Translate;

describe('weaponLabel', () => {
    it('shows a barrel kill as Barrel / Бочка', () => {
        expect(weaponLabel(tIn('en'), 'Barrel')).toBe('Barrel');
        expect(weaponLabel(tIn('ru'), 'Barrel')).toBe('Бочка');
    });

    it('translates a weapon name and leaves an unknown one as it is', () => {
        expect(weaponLabel(tIn('ru'), 'Chainsaw')).toBe('Бензопила');
        expect(weaponLabel(tIn('ru'), 'Environment')).toBe('Environment');
    });
});
