import { describe, it, expect, afterEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslation } from '../../i18n/useTranslation';
import { progressLabel } from './achievementProgress';

const veteran = (progress: number) => ({ id: 'veteran', progress, maxProgress: 36000 });
const kingOfHill = (progress: number) => ({ id: 'king_of_hill', progress, maxProgress: 500 });

const translator = (language: 'en' | 'ru') => {
    (localStorage.getItem as Mock).mockImplementation((key: string) => (key === 'gameLanguage' ? language : null));
    return renderHook(() => useTranslation()).result.current.t;
};

describe('progressLabel', () => {
    afterEach(() => { (localStorage.getItem as Mock).mockReset(); });

    it('shows Veteran in whole hours, rounded down', () => {
        const t = translator('en');
        expect(progressLabel(veteran(0), t)).toBe('0 / 10 h');
        expect(progressLabel(veteran(7199), t)).toBe('1 / 10 h');
        expect(progressLabel(veteran(7200), t)).toBe('2 / 10 h');
        expect(progressLabel(veteran(35999), t)).toBe('9 / 10 h');
    });

    it('shows King of the Hill in seconds', () => {
        const t = translator('en');
        expect(progressLabel(kingOfHill(123), t)).toBe('123 / 500 s');
        expect(progressLabel(kingOfHill(123.7), t)).toBe('123 / 500 s');
    });

    it('uses the Russian units', () => {
        const t = translator('ru');
        expect(progressLabel(veteran(7500), t)).toBe('2 / 10 ч');
        expect(progressLabel(kingOfHill(123), t)).toBe('123 / 500 с');
    });

    it('keeps a plain count for every other achievement', () => {
        const t = translator('en');
        expect(progressLabel({ id: 'executioner', progress: 32, maxProgress: 100 }, t)).toBe('32 / 100');
    });
});
