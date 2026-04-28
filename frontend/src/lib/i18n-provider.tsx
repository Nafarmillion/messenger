'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useLanguageStore, Locale } from '@/store/language-store';
import en from '@/locales/en.json';
import uk from '@/locales/uk.json';

const translations: Record<Locale, typeof en> = { en, uk };

type TranslationKey = string;

interface TranslationContextType {
  t: (key: TranslationKey) => string;
  locale: Locale;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

function getNestedTranslation(obj: any, path: string): string {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // Return key if translation not found
    }
  }
  
  return typeof result === 'string' ? result : path;
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { locale } = useLanguageStore();
  const [, forceUpdate] = useState(0);

  // Force re-render when locale changes
  useEffect(() => {
    forceUpdate((n) => n + 1);
  }, [locale]);

  const t = (key: TranslationKey): string => {
    const currentTranslations = translations[locale];
    return getNestedTranslation(currentTranslations, key);
  };

  return (
    <TranslationContext.Provider value={{ t, locale }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
