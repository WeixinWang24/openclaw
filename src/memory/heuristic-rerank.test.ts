import { describe, expect, it } from "vitest";
import type { ChunkMetadata } from "./chunk-metadata.js";
import { heuristicRerank } from "./heuristic-rerank.js";

function makeResult(overrides: {
  score: number;
  snippet?: string;
  metadata?: ChunkMetadata;
  path?: string;
}) {
  return {
    path: overrides.path ?? "memory/test.md",
    startLine: 1,
    endLine: 5,
    score: overrides.score,
    snippet:
      overrides.snippet ?? "A reasonable snippet with enough content to avoid noise penalty.",
    source: "memory",
    metadata: overrides.metadata,
  };
}

function makeMetadata(overrides: Partial<ChunkMetadata> = {}): ChunkMetadata {
  return {
    docKind: "unknown",
    headingPath: "",
    sectionType: "prose",
    signals: {
      containsDecision: false,
      containsRule: false,
      containsStatus: false,
      containsResume: false,
    },
    ...overrides,
  };
}

describe("heuristicRerank", () => {
  it("returns empty array for empty input", () => {
    expect(heuristicRerank([])).toEqual([]);
  });

  it("does not change order when disabled", () => {
    const results = [makeResult({ score: 0.5 }), makeResult({ score: 0.8 })];
    const reranked = heuristicRerank(results, { enabled: false });
    expect(reranked[0].score).toBe(0.5);
    expect(reranked[1].score).toBe(0.8);
  });

  it("boosts evergreen docs over unknown docs at similar scores", () => {
    const evergreenResult = makeResult({
      score: 0.7,
      metadata: makeMetadata({ docKind: "evergreen" }),
    });
    const unknownResult = makeResult({
      score: 0.71,
      metadata: makeMetadata({ docKind: "unknown" }),
    });
    const reranked = heuristicRerank([unknownResult, evergreenResult], { enabled: true });
    // Evergreen gets +0.03 boost, should now outrank unknown
    expect(reranked[0].metadata?.docKind).toBe("evergreen");
  });

  it("penalizes noisy short snippets", () => {
    const goodResult = makeResult({ score: 0.5 });
    const noisyResult = makeResult({
      score: 0.52,
      snippet: "...",
    });
    const reranked = heuristicRerank([noisyResult, goodResult], { enabled: true });
    // Noisy snippet gets penalty, good result should rank higher
    expect(reranked[0].snippet).toContain("reasonable");
  });

  it("boosts decision-signal chunks", () => {
    const decisionResult = makeResult({
      score: 0.6,
      metadata: makeMetadata({
        signals: {
          containsDecision: true,
          containsRule: false,
          containsStatus: false,
          containsResume: false,
        },
      }),
    });
    const plainResult = makeResult({
      score: 0.6,
      metadata: makeMetadata(),
    });
    const reranked = heuristicRerank([plainResult, decisionResult], { enabled: true });
    expect(reranked[0].metadata?.signals.containsDecision).toBe(true);
  });

  it("clamps delta to maxBoostFraction of original score", () => {
    const result = makeResult({
      score: 0.1,
      metadata: makeMetadata({
        docKind: "evergreen",
        sectionType: "heading",
        signals: {
          containsDecision: true,
          containsRule: true,
          containsStatus: true,
          containsResume: true,
        },
      }),
    });
    const [reranked] = heuristicRerank([result], { enabled: true, maxBoostFraction: 0.15 });
    // Max boost should be 0.15 * 0.1 = 0.015 (minimum 0.01)
    expect(reranked.score).toBeLessThanOrEqual(0.1 + 0.015);
    expect(reranked.score).toBeGreaterThan(0.1);
  });

  it("preserves results without metadata", () => {
    const result = makeResult({ score: 0.5 });
    const [reranked] = heuristicRerank([result]);
    expect(reranked.score).toBeCloseTo(0.5, 1);
  });
});
