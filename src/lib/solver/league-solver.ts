export type LeagueConfig = {
  leagueCount: number;
  sizes: number[];
  totalSlots: number;
  overage: number;
  score: number;
  description: string;
};

/**
 * Given N confirmed participants, recommend optimal league configurations.
 * Returns top 5 configs sorted by score descending.
 */
export function solveLeagueStructure(
  confirmedCount: number,
  options?: {
    preferredSize?: number;
    allowedSizes?: number[];
    maxLeagues?: number;
  }
): LeagueConfig[] {
  const preferredSize = options?.preferredSize ?? 10;
  const allowedSizes = options?.allowedSizes ?? [8, 10, 12];
  const maxLeagues = options?.maxLeagues ?? 20;

  if (confirmedCount < 2) return [];

  const configs: LeagueConfig[] = [];

  // Try every combination of league counts and sizes
  const minLeagues = Math.max(1, Math.ceil(confirmedCount / Math.max(...allowedSizes)));
  const maxL = Math.min(maxLeagues, Math.ceil(confirmedCount / Math.min(...allowedSizes)));

  for (let numLeagues = minLeagues; numLeagues <= maxL; numLeagues++) {
    // For each league count, try to find the best distribution
    const candidates = generateDistributions(confirmedCount, numLeagues, allowedSizes);

    for (const sizes of candidates) {
      const totalSlots = sizes.reduce((a, b) => a + b, 0);
      const overage = totalSlots - confirmedCount;

      // Skip configs that are too far off
      if (Math.abs(overage) > Math.max(...allowedSizes)) continue;

      const score = scoreConfig(sizes, confirmedCount, preferredSize);
      const description = describeConfig(sizes);

      configs.push({
        leagueCount: numLeagues,
        sizes: sizes.sort((a, b) => b - a),
        totalSlots,
        overage,
        score,
        description,
      });
    }
  }

  // Deduplicate by sizes signature
  const seen = new Set<string>();
  const unique = configs.filter((c) => {
    const key = c.sizes.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.score - a.score).slice(0, 5);
}

function generateDistributions(
  total: number,
  numLeagues: number,
  allowedSizes: number[]
): number[][] {
  const results: number[][] = [];

  // Strategy 1: All same size (for each allowed size)
  for (const size of allowedSizes) {
    const sizes = Array(numLeagues).fill(size);
    results.push(sizes);
  }

  // Strategy 2: Mix of two sizes to get closest to total
  for (let i = 0; i < allowedSizes.length; i++) {
    for (let j = i + 1; j < allowedSizes.length; j++) {
      const small = allowedSizes[i];
      const large = allowedSizes[j];

      // Solve: x * large + (numLeagues - x) * small = total
      // x * (large - small) = total - numLeagues * small
      // x = (total - numLeagues * small) / (large - small)
      const diff = large - small;
      if (diff === 0) continue;

      const x = (total - numLeagues * small) / diff;
      const xRound = Math.round(x);

      if (xRound >= 0 && xRound <= numLeagues) {
        const sizes = [
          ...Array(xRound).fill(large),
          ...Array(numLeagues - xRound).fill(small),
        ];
        results.push(sizes);
      }

      // Also try floor and ceil
      for (const xTry of [Math.floor(x), Math.ceil(x)]) {
        if (xTry >= 0 && xTry <= numLeagues) {
          const sizes = [
            ...Array(xTry).fill(large),
            ...Array(numLeagues - xTry).fill(small),
          ];
          results.push(sizes);
        }
      }
    }
  }

  return results;
}

function scoreConfig(sizes: number[], confirmedCount: number, preferredSize: number): number {
  let score = 0;
  const totalSlots = sizes.reduce((a, b) => a + b, 0);

  // Exact fit bonus
  if (totalSlots === confirmedCount) score += 20;

  // Prefer leagues at preferred size
  for (const size of sizes) {
    if (size === preferredSize) score += 10;
    else score -= 5;
  }

  // Penalize mixed sizes
  const distinctSizes = new Set(sizes).size;
  if (distinctSizes > 2) score -= 3 * (distinctSizes - 2);

  // Penalize overage/underage
  score -= 2 * Math.abs(totalSlots - confirmedCount);

  return score;
}

function describeConfig(sizes: number[]): string {
  const counts: Record<number, number> = {};
  for (const size of sizes) {
    counts[size] = (counts[size] ?? 0) + 1;
  }

  const parts = Object.entries(counts)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([size, count]) => {
      if (count === 1) return `1 league of ${size}`;
      return `${count} leagues of ${size}`;
    });

  return parts.join(' + ');
}
