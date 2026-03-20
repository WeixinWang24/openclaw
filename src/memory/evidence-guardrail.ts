/**
 * Low-evidence guardrail for memory search results.
 *
 * Assesses whether retrieved evidence is strong enough to support
 * a confident answer. Returns a confidence level and optional warning
 * that downstream consumers can use to qualify their responses.
 */

export type EvidenceConfidence = "high" | "moderate" | "low" | "insufficient";

export type EvidenceAssessment = {
  confidence: EvidenceConfidence;
  topScore: number;
  meanScore: number;
  resultCount: number;
  scoreSpread: number;
  warning?: string;
};

export type EvidenceGuardrailConfig = {
  enabled: boolean;
  /** Minimum top score to consider evidence sufficient. Default: 0.35 */
  minTopScore: number;
  /** Minimum number of results for "high" confidence. Default: 2 */
  minResultsForHigh: number;
  /** Score threshold below which a result is considered weak. Default: 0.25 */
  weakScoreThreshold: number;
  /** Maximum score spread (max-min) before flagging heterogeneity. Default: 0.4 */
  maxScoreSpread: number;
};

export const DEFAULT_EVIDENCE_GUARDRAIL_CONFIG: EvidenceGuardrailConfig = {
  enabled: true,
  minTopScore: 0.35,
  minResultsForHigh: 2,
  weakScoreThreshold: 0.25,
  maxScoreSpread: 0.4,
};

export function assessEvidence(
  results: Array<{ score: number }>,
  config: Partial<EvidenceGuardrailConfig> = {},
): EvidenceAssessment {
  const cfg = { ...DEFAULT_EVIDENCE_GUARDRAIL_CONFIG, ...config };

  if (results.length === 0) {
    return {
      confidence: "insufficient",
      topScore: 0,
      meanScore: 0,
      resultCount: 0,
      scoreSpread: 0,
      warning: "No memory results found. The answer may not reflect prior context.",
    };
  }

  const scores = results.map((r) => r.score).toSorted((a, b) => b - a);
  const topScore = scores[0];
  const meanScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const scoreSpread = scores.length > 1 ? scores[0] - scores[scores.length - 1] : 0;
  const resultCount = results.length;

  // Insufficient: top score is below weak threshold
  if (topScore < cfg.weakScoreThreshold) {
    return {
      confidence: "insufficient",
      topScore,
      meanScore,
      resultCount,
      scoreSpread,
      warning:
        "Retrieved memories have very low relevance scores. " +
        "The information may not be available in memory.",
    };
  }

  // Low: top score doesn't meet minimum or all results are weak
  if (topScore < cfg.minTopScore) {
    return {
      confidence: "low",
      topScore,
      meanScore,
      resultCount,
      scoreSpread,
      warning:
        "Memory results have low confidence scores. " +
        "The answer may be incomplete or inaccurate.",
    };
  }

  // Check heterogeneity: high spread suggests mixed/noisy results
  const isHeterogeneous = scoreSpread > cfg.maxScoreSpread && resultCount > 2;

  // High: good top score, enough results, not too spread out
  if (topScore >= cfg.minTopScore && resultCount >= cfg.minResultsForHigh && !isHeterogeneous) {
    return {
      confidence: "high",
      topScore,
      meanScore,
      resultCount,
      scoreSpread,
    };
  }

  // Moderate: decent top score but few results or high spread
  return {
    confidence: "moderate",
    topScore,
    meanScore,
    resultCount,
    scoreSpread,
    ...(isHeterogeneous
      ? {
          warning:
            "Memory results show high score variation. " +
            "Some retrieved context may not be directly relevant.",
        }
      : {}),
  };
}
