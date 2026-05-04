/**
 * Weighted random selection from scored candidates.
 *
 * Uses a seedable mulberry32 PRNG so selections are deterministic for
 * a given seed — callers can replay the sequence (e.g. for "up next" previews).
 */

export interface ScoredCandidate<T> {
  item: T;
  score: number;
}

/**
 * Mulberry32 — a simple 32-bit seedable PRNG.
 * Returns a function that produces floats in [0, 1) on each call.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a daily seed from a Date — resets each UTC day so the sequence
 * is stable within a day but changes across days.
 */
export function dailySeed(now: Date = new Date()): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return y * 10000 + m * 100 + d;
}

/** Default shared RNG, re-seeded per day. */
let _rng: (() => number) | null = null;
let _rngDay = -1;

function getRng(): () => number {
  const today = dailySeed();
  if (!_rng || _rngDay !== today) {
    _rng = mulberry32(today);
    _rngDay = today;
  }
  return _rng;
}

/**
 * Pick one item using weighted-random selection.
 * Returns null if candidates is empty or all scores are 0.
 *
 * Accepts an optional `rng` function (float in [0,1)) so callers can
 * supply their own seeded generator (e.g. for simulating future ticks).
 */
export function weightedRandom<T>(
  candidates: ScoredCandidate<T>[],
  rng?: () => number,
): T | null {
  if (candidates.length === 0) return null;

  const rand = rng ?? getRng();

  const total = candidates.reduce((sum, c) => sum + c.score, 0);
  if (total <= 0) {
    // All scores zero — pick uniformly at random
    return candidates[Math.floor(rand() * candidates.length)].item;
  }

  let r = rand() * total;
  for (const c of candidates) {
    r -= c.score;
    if (r <= 0) return c.item;
  }

  // Floating-point guard
  return candidates[candidates.length - 1].item;
}
