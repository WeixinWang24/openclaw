import { describe, expect, it } from "vitest";
import { assessEvidence } from "./evidence-guardrail.js";

describe("assessEvidence", () => {
  it("returns insufficient for empty results", () => {
    const assessment = assessEvidence([]);
    expect(assessment.confidence).toBe("insufficient");
    expect(assessment.warning).toBeTruthy();
    expect(assessment.resultCount).toBe(0);
  });

  it("returns insufficient when top score is very low", () => {
    const assessment = assessEvidence([{ score: 0.1 }, { score: 0.05 }]);
    expect(assessment.confidence).toBe("insufficient");
    expect(assessment.warning).toBeTruthy();
  });

  it("returns low when top score is below minTopScore", () => {
    const assessment = assessEvidence([{ score: 0.3 }, { score: 0.28 }]);
    expect(assessment.confidence).toBe("low");
    expect(assessment.warning).toBeTruthy();
  });

  it("returns high for strong results", () => {
    const assessment = assessEvidence([{ score: 0.8 }, { score: 0.7 }, { score: 0.65 }]);
    expect(assessment.confidence).toBe("high");
    expect(assessment.warning).toBeUndefined();
  });

  it("returns moderate for single strong result", () => {
    const assessment = assessEvidence([{ score: 0.8 }]);
    expect(assessment.confidence).toBe("moderate");
  });

  it("returns moderate for heterogeneous results", () => {
    const assessment = assessEvidence([{ score: 0.9 }, { score: 0.6 }, { score: 0.3 }]);
    expect(assessment.confidence).toBe("moderate");
    expect(assessment.warning).toContain("score variation");
  });

  it("computes correct metrics", () => {
    const assessment = assessEvidence([{ score: 0.8 }, { score: 0.6 }]);
    expect(assessment.topScore).toBe(0.8);
    expect(assessment.meanScore).toBeCloseTo(0.7);
    expect(assessment.resultCount).toBe(2);
    expect(assessment.scoreSpread).toBeCloseTo(0.2);
  });

  it("respects custom config", () => {
    const assessment = assessEvidence([{ score: 0.5 }], { minTopScore: 0.4, minResultsForHigh: 1 });
    expect(assessment.confidence).toBe("high");
  });
});
