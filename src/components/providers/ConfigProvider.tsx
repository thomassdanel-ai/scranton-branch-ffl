'use client';

import { createContext, useContext } from 'react';
import type { LeagueInfo } from '@/lib/config';

export type MemberIdentity = {
  memberId: string;
  memberName: string;
  leagueId: string;
  leagueName: string;
} | null;

type ConfigContextValue = {
  leagues: LeagueInfo[];
  seasonYear: string;
  member: MemberIdentity;
};

const ConfigContext = createContext<ConfigContextValue>({ leagues: [], seasonYear: '', member: null });

export function ConfigProvider({
  leagues,
  seasonYear,
  member,
  children,
}: {
  leagues: LeagueInfo[];
  seasonYear: string;
  member?: MemberIdentity;
  children: React.ReactNode;
}) {
  return (
    <ConfigContext.Provider value={{ leagues, seasonYear, member: member ?? null }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useLeagueConfig() {
  return useContext(ConfigContext);
}
