'use client';

import { createContext, useContext } from 'react';
import type { LeagueInfo } from '@/lib/config';

type ConfigContextValue = {
  leagues: LeagueInfo[];
  seasonYear: string;
};

const ConfigContext = createContext<ConfigContextValue>({ leagues: [], seasonYear: '' });

export function ConfigProvider({
  leagues,
  seasonYear,
  children,
}: {
  leagues: LeagueInfo[];
  seasonYear: string;
  children: React.ReactNode;
}) {
  return (
    <ConfigContext.Provider value={{ leagues, seasonYear }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useLeagueConfig() {
  return useContext(ConfigContext);
}
