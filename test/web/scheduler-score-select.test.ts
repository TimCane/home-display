/**
 * Integration tests for the scheduler scoring and selection logic.
 *
 * Tests scoreEntry, decay, weightedRandom, and mulberry32 as they work
 * together to implement the entry selection pipeline.
 */

import { describe, it, expect } from "vitest";
import { decay, scoreEntry } from "../../src/web/server/scheduler/score.js";
import {
  weightedRandom,
  mulberry32,
  dailySeed,
  type ScoredCandidate,
} from "../../src/web/server/scheduler/select.js";

// ─── decay() ────────────────────────────────────────────────────────────────

describe("decay", () => {
  const halfLifeH = 6;
  const now = new Date("2026-06-15T12:00:00Z");

  it("returns 1 when lastShownAt is null (never shown)", () => {
    expect(decay(null, halfLifeH, now)).toBe(1);
  });

  it("returns ~0 immediately after being shown", () => {
    const justNow = new Date(now.getTime() - 1000); // 1 second ago
    expect(decay(justNow, halfLifeH, now)).toBeCloseTo(0, 2);
  });

  it("returns ~0.5 at one half-life", () => {
    const oneHalfLife = new Date(now.getTime() - halfLifeH * 60 * 60 * 1000);
    const d = decay(oneHalfLife, halfLifeH, now);
    // 1 - exp(-1) ≈ 0.6321
    expect(d).toBeCloseTo(0.6321, 3);
  });

  it("saturates near 1 after several half-lives", () => {
    const longAgo = new Date(now.getTime() - 5 * halfLifeH * 60 * 60 * 1000);
    expect(decay(longAgo, halfLifeH, now)).toBeGreaterThan(0.99);
  });

  it("increases monotonically with time since last shown", () => {
    const times = [1, 2, 4, 8, 16, 32].map(
      (h) => new Date(now.getTime() - h * 60 * 60 * 1000),
    );
    const decays = times.map((t) => decay(t, halfLifeH, now));
    for (let i = 1; i < decays.length; i++) {
      expect(decays[i]).toBeGreaterThan(decays[i - 1]);
    }
  });
});

// ─── scoreEntry() ───────────────────────────────────────────────────────────

describe("scoreEntry", () => {
  const halfLifeH = 6;
  const firstViewBoost = 5;
  const now = new Date("2026-06-15T12:00:00Z");

  it("applies first-view boost when showCount is 0", () => {
    const score = scoreEntry(1, null, 0, halfLifeH, firstViewBoost, now);
    // baseWeight * decay(null) + firstViewBoost = 1 * 1 + 5 = 6
    expect(score).toBe(6);
  });

  it("does not apply first-view boost when showCount > 0", () => {
    const score = scoreEntry(1, null, 1, halfLifeH, firstViewBoost, now);
    // baseWeight * decay(null) = 1 * 1 = 1
    expect(score).toBe(1);
  });

  it("higher baseWeight produces higher score", () => {
    const low = scoreEntry(1, null, 5, halfLifeH, firstViewBoost, now);
    const high = scoreEntry(10, null, 5, halfLifeH, firstViewBoost, now);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeCloseTo(low * 10);
  });

  it("recently shown entry scores lower than stale entry", () => {
    const recentlyShown = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago
    const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

    const recentScore = scoreEntry(
      1, recentlyShown, 5, halfLifeH, firstViewBoost, now,
    );
    const staleScore = scoreEntry(
      1, stale, 5, halfLifeH, firstViewBoost, now,
    );
    expect(staleScore).toBeGreaterThan(recentScore);
  });

  it("never-shown entry with boost beats high-weight recently-shown entry", () => {
    const justShown = new Date(now.getTime() - 60 * 1000); // 1 min ago
    const neverShown = scoreEntry(1, null, 0, halfLifeH, firstViewBoost, now);
    const highWeightJustShown = scoreEntry(
      3, justShown, 10, halfLifeH, firstViewBoost, now,
    );
    expect(neverShown).toBeGreaterThan(highWeightJustShown);
  });
});

// ─── mulberry32 / dailySeed ─────────────────────────────────────────────────

describe("mulberry32", () => {
  it("produces deterministic sequence for a given seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it("different seeds produce different sequences", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(43);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it("values are in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("dailySeed", () => {
  it("same day produces same seed", () => {
    const a = dailySeed(new Date("2026-06-15T03:00:00Z"));
    const b = dailySeed(new Date("2026-06-15T22:59:59Z"));
    expect(a).toBe(b);
  });

  it("different days produce different seeds", () => {
    const a = dailySeed(new Date("2026-06-15T12:00:00Z"));
    const b = dailySeed(new Date("2026-06-16T12:00:00Z"));
    expect(a).not.toBe(b);
  });
});

// ─── weightedRandom() ───────────────────────────────────────────────────────

describe("weightedRandom", () => {
  it("returns null for empty candidates", () => {
    expect(weightedRandom([])).toBeNull();
  });

  it("returns the only candidate when there is one", () => {
    const candidates: ScoredCandidate<string>[] = [
      { item: "only", score: 5 },
    ];
    const rng = mulberry32(1);
    expect(weightedRandom(candidates, rng)).toBe("only");
  });

  it("heavily weighted candidate is selected most often", () => {
    const candidates: ScoredCandidate<string>[] = [
      { item: "heavy", score: 100 },
      { item: "light", score: 1 },
    ];

    let heavyCount = 0;
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      if (weightedRandom(candidates, rng) === "heavy") heavyCount++;
    }
    // Should be selected ~99% of the time
    expect(heavyCount).toBeGreaterThan(950);
  });

  it("all-zero scores picks uniformly", () => {
    const candidates: ScoredCandidate<string>[] = [
      { item: "a", score: 0 },
      { item: "b", score: 0 },
      { item: "c", score: 0 },
    ];

    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const rng = mulberry32(42);
    for (let i = 0; i < 3000; i++) {
      const pick = weightedRandom(candidates, rng)!;
      counts[pick]++;
    }
    // Each should be picked roughly 1000 times (±200)
    expect(counts.a).toBeGreaterThan(700);
    expect(counts.b).toBeGreaterThan(700);
    expect(counts.c).toBeGreaterThan(700);
  });

  it("is deterministic with same rng seed", () => {
    const candidates: ScoredCandidate<string>[] = [
      { item: "a", score: 3 },
      { item: "b", score: 5 },
      { item: "c", score: 2 },
    ];

    const rng1 = mulberry32(99);
    const rng2 = mulberry32(99);
    const seq1 = Array.from({ length: 20 }, () => weightedRandom(candidates, rng1));
    const seq2 = Array.from({ length: 20 }, () => weightedRandom(candidates, rng2));
    expect(seq1).toEqual(seq2);
  });
});

// ─── End-to-end scoring pipeline ────────────────────────────────────────────

describe("scoring pipeline integration", () => {
  const halfLifeH = 6;
  const firstViewBoost = 5;
  const now = new Date("2026-06-15T12:00:00Z");

  interface MockEntry {
    id: string;
    baseWeight: number;
    lastShownAt: Date | null;
    showCount: number;
  }

  function buildCandidates(entries: MockEntry[]): ScoredCandidate<MockEntry>[] {
    return entries.map((e) => ({
      item: e,
      score: scoreEntry(
        e.baseWeight,
        e.lastShownAt,
        e.showCount,
        halfLifeH,
        firstViewBoost,
        now,
      ),
    }));
  }

  it("new entry beats stale high-weight entry in first view", () => {
    const entries: MockEntry[] = [
      { id: "new", baseWeight: 1, lastShownAt: null, showCount: 0 },
      {
        id: "stale-heavy",
        baseWeight: 3,
        lastShownAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        showCount: 50,
      },
    ];

    const scored = buildCandidates(entries);
    // new: 1*1 + 5 = 6; stale-heavy: 3 * ~0.98 = ~2.94
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it("simulates multiple ticks and never picks the same entry twice in a row", () => {
    const entries: MockEntry[] = [
      { id: "a", baseWeight: 1, lastShownAt: null, showCount: 0 },
      { id: "b", baseWeight: 1, lastShownAt: null, showCount: 0 },
      { id: "c", baseWeight: 1, lastShownAt: null, showCount: 0 },
    ];

    const rng = mulberry32(42);
    let currentId: string | null = null;

    for (let tick = 0; tick < 30; tick++) {
      // Exclude current entry (mimicking real scheduler)
      const eligible = entries.filter((e) => e.id !== currentId);
      const scored = buildCandidates(eligible);
      const winner = weightedRandom(scored, rng);
      expect(winner).not.toBeNull();
      expect(winner!.id).not.toBe(currentId);

      // Update simulated state
      winner!.lastShownAt = now;
      winner!.showCount++;
      currentId = winner!.id;
    }
  });
});
