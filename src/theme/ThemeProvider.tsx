import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import type { ReactNode } from 'react';

type ThemeSetting = 'light' | 'dark' | 'system';
type ThemeContextValue = {
  setting: ThemeSetting;          // user choice
  effective: 'light' | 'dark';    // actually applied
  setSetting: (t: ThemeSetting) => void;
};

const ThemeCtx = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'cae:theme';

export function ThemeProvider({children}: {children: ReactNode}) {
  const mql = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) as ThemeSetting | null;
    return saved ?? 'system';
  });

  const effective: 'light' | 'dark' = useMemo(() => {
    if (setting === 'system') return mql?.matches ? 'dark' : 'light';
    return setting;
  }, [setting, mql?.matches]);

  useEffect(() => {
    document.documentElement.dataset.theme = effective; // <html data-theme="dark|light">
  }, [effective]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, setting);
  }, [setting]);

  useEffect(() => {
    if (!mql) return;
    const onChange = () => { if (setting === 'system') document.documentElement.dataset.theme = mql.matches ? 'dark' : 'light'; };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [mql, setting]);

  return (
    <ThemeCtx.Provider value={{setting, effective, setSetting}}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
