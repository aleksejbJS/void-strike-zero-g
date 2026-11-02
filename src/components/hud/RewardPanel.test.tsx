import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { translations } from '../../i18n/locales';
import type { Reward } from '../../game/build/progress';
import { RewardPanel } from './RewardPanel';
import type { Translate } from '../menu/types';

const tFor = (lang: 'en' | 'ru') => ((key: keyof typeof translations.en, ...args: unknown[]) =>
    translations[lang][key].replace(/{(\d+)}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m))) as Translate;

const reward: Reward = {
    gained: 50, levelBefore: 2, levelAfter: 3,
    unlocked: [{ slot: 'visor', id: 'glass', source: 'level', level: 3 }],
};

describe('RewardPanel', () => {
    it('English: XP, level and the opened part with its slot', () => {
        render(<RewardPanel t={tFor('en')} reward={reward} />);
        expect(screen.getByText('+50 XP')).toBeInTheDocument();
        expect(screen.getByText('Level 3!')).toBeInTheDocument();
        expect(screen.getByText('New part — Visor: Glass')).toBeInTheDocument();
    });

    it('Russian: the same, with "опыта" like the XP bar', () => {
        render(<RewardPanel t={tFor('ru')} reward={reward} />);
        expect(screen.getByText('+50 опыта')).toBeInTheDocument();
        expect(screen.getByText('Уровень 3!')).toBeInTheDocument();
        expect(screen.getByText('Новая деталь — Визор: Стекло')).toBeInTheDocument();
    });
});
