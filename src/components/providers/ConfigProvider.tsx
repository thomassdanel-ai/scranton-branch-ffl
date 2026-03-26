'use client';

import { createContext, useContext } from 'react';
import type { LeagueInfo } from '@/lib/config';

type ConfigContextValue = {
  leagues: LeagueInfo[];
};

const ConfigContext = createContext<ConfigContextValue>({ leagues: [] });

export function ConfigProvider({
  leagues,
  children,
}: {
  leagues: LeagueInfo[];
  children: React.ReactNode;
}) {
  return (
    <ConfigContext.Provider value={{ leagues }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useLeagueConfig() {
  return useContext(ConfigContext);
}
