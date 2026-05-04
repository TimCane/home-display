/**
 * Decay function and entry scoring for the scheduler.
 *
 * decay(t, halfLifeH) = 1 - exp(-hoursSince(t) / halfLifeH)
 * Near 0 immediately after shown, saturates near 1 after ~2× half-life.
 * null lastShownAt → fully decayed (returns 1).
 */

export function decay(
  lastShownAt: Date | null,
  halfLifeH: number,
  now: Date = new Date(),
): number {
  if (lastShownAt === null) return 1;
  const hoursSince =
    (now.getTime() - lastShownAt.getTime()) / (1000 * 60 * 60);
  return 1 - Math.exp(-hoursSince / halfLifeH);
}

export function scoreEntry(
  baseWeight: number,
  lastShownAt: Date | null,
  showCount: number,
  halfLifeH: number,
  firstViewBoost: number,
  now: Date = new Date(),
): number {
  const d = decay(lastShownAt, halfLifeH, now);
  let score = baseWeight * d;
  if (showCount === 0) {
    score += firstViewBoost;
  }
  return score;
}
