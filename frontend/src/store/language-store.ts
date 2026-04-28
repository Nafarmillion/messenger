import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'en' | 'uk';

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'language-storage',
    }
  )
);
