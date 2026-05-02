/**
 * Weighted random selection from scored candidates.
 */

export interface ScoredCandidate<T> {
  item: T;
  score: number;
}

/**
 * Pick one item using weighted-random selection.
 * Returns null if candidates is empty or all scores are 0.
 */
export function weightedRandom<T>(
  candidates: ScoredCandidate<T>[],
): T | null {
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, c) => sum + c.score, 0);
  if (total <= 0) {
    // All scores zero — pick uniformly at random
    return candidates[Math.floor(Math.random() * candidates.length)].item;
  }

  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.score;
    if (r <= 0) return c.item;
  }

  // Floating-point guard
  return candidates[candidates.length - 1].item;
}
