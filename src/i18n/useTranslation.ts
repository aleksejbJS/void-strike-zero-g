import { useState, useEffect } from 'react';
import { TranslationKeys, translations } from './locales';
import { Language } from '../types';

const STORAGE_KEY = 'gameLanguage';

export const useTranslation = () => {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved === 'en' || saved === 'ru') ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    try {
      localStorage.setItem(STORAGE_KEY, newLanguage);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  };

  const t = (key: keyof TranslationKeys, ...args: any[]): string => {
    const translation = translations[language][key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }

    // Simple interpolation for placeholders like {0}, {1}, etc.
    return translation.replace(/{(\d+)}/g, (match, index) => {
      return args[index] !== undefined ? String(args[index]) : match;
    });
  };

  return { t, language, changeLanguage };
};
