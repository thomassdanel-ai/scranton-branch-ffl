export const LEAGUE_CONFIG = {
  name: "Scranton Branch Fantasy Football League",
  shortName: "Scranton Branch FFL",
  commissionerUserId: "739591965980643328",
  currentSeason: "2025",
  leagues: [
    {
      id: "1260755589445718016",
      name: "Sales",
      shortName: "Sales",
      color: "#3b82f6",
    },
    {
      id: "1259609557903081472",
      name: "Accounting",
      shortName: "Acct",
      color: "#10b981",
    },
  ],
  championship: {
    qualifiersPerLeague: 3,
    format: "bracket" as const,
  },
};

export type LeagueInfo = typeof LEAGUE_CONFIG.leagues[number];
