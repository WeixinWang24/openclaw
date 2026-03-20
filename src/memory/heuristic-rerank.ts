/**
 * Heuristic reranking for memory search results.
 *
 * Applies lightweight score adjustments based on chunk metadata signals
 * after initial vector/keyword retrieval. Keeps semantic score dominant.
 */

import type { ChunkMetadata, DocKind, SectionType } from "./chunk-metadata.js";

export type HeuristicRerankConfig = {
  enabled: boolean;
  /** Max additive boost from all heuristics combined (fraction of raw score). Default: 0.15 */
  maxBoostFraction: number;
};

export const DEFAULT_HEURISTIC_RERANK_CONFIG: HeuristicRerankConfig = {
  enabled: false,
  maxBoostFraction: 0.15,
};

export type RerankableResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: string;
  metadata?: ChunkMetadata;
};

// ---------- Score adjustments ----------

/** Small additive bonus by document kind. Evergreen/config chunks get a slight boost. */
const DOC_KIND_BONUS: Record<DocKind, number> = {
  evergreen: 0.03,
  config: 0.02,
  "daily-log": 0.0,
  session: -0.01,
  reference: 0.01,
  unknown: 0.0,
};

/** Small additive bonus by section type. Headings and lists are slightly preferred. */
const SECTION_TYPE_BONUS: Record<SectionType, number> = {
  heading: 0.02,
  list: 0.01,
  prose: 0.0,
  code: -0.01,
  frontmatter: -0.02,
  unknown: 0.0,
};

/** Bonus for signal presence. Decision/rule signals get a mild boost. */
const SIGNAL_BONUSES = {
  containsDecision: 0.02,
  containsRule: 0.02,
  containsStatus: 0.01,
  containsResume: 0.01,
} as const;

// ---------- Noise penalty ----------

/**
 * Penalize very short snippets that are unlikely to carry useful information.
 * Also penalize snippets that are mostly whitespace or punctuation.
 */
function noisePenalty(snippet: string): number {
  const trimmed = snippet.trim();
  if (trimmed.length < 20) {
    return -0.05;
  }
  if (trimmed.length < 50) {
    return -0.02;
  }

  // Ratio of alphanumeric chars to total — very low means noise
  const alphaNum = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const ratio = alphaNum / trimmed.length;
  if (ratio < 0.3) {
    return -0.03;
  }

  return 0;
}

// ---------- Main reranker ----------

export function heuristicRerank<T extends RerankableResult>(
  results: T[],
  config: Partial<HeuristicRerankConfig> = {},
): T[] {
  const resolved = { ...DEFAULT_HEURISTIC_RERANK_CONFIG, ...config };
  if (!resolved.enabled || results.length === 0) {
    return results;
  }

  const adjusted = results.map((result) => {
    if (!result.metadata) {
      // No metadata — only apply noise penalty
      const noise = noisePenalty(result.snippet);
      const clampedDelta = clampDelta(noise, result.score, resolved.maxBoostFraction);
      return { ...result, score: result.score + clampedDelta };
    }

    const meta = result.metadata;
    let delta = 0;

    // Document kind bonus
    delta += DOC_KIND_BONUS[meta.docKind] ?? 0;

    // Section type bonus
    delta += SECTION_TYPE_BONUS[meta.sectionType] ?? 0;

    // Signal bonuses
    for (const [key, bonus] of Object.entries(SIGNAL_BONUSES)) {
      if (meta.signals[key as keyof typeof SIGNAL_BONUSES]) {
        delta += bonus;
      }
    }

    // Noise penalty
    delta += noisePenalty(result.snippet);

    // Clamp total delta to maxBoostFraction of the original score
    const clampedDelta = clampDelta(delta, result.score, resolved.maxBoostFraction);

    return { ...result, score: result.score + clampedDelta };
  });

  return adjusted.toSorted((a, b) => b.score - a.score);
}

function clampDelta(delta: number, originalScore: number, maxFraction: number): number {
  const maxAbsDelta = Math.max(0.01, Math.abs(originalScore) * maxFraction);
  return Math.max(-maxAbsDelta, Math.min(maxAbsDelta, delta));
}
