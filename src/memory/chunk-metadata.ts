/**
 * Chunk metadata enrichment for improved retrieval ranking.
 *
 * Provides:
 * - Path-based document classification (docKind)
 * - Heading/section annotation for markdown chunks (headingPath, sectionType)
 * - Signal detection for decision/rule/status/resume content
 */

// ---------- Document kind classification ----------

export type DocKind = "daily-log" | "evergreen" | "session" | "config" | "reference" | "unknown";

export type SectionType = "heading" | "prose" | "list" | "code" | "frontmatter" | "unknown";

export type ChunkMetadata = {
  docKind: DocKind;
  headingPath: string;
  sectionType: SectionType;
  signals: ChunkSignals;
};

export type ChunkSignals = {
  containsDecision: boolean;
  containsRule: boolean;
  containsStatus: boolean;
  containsResume: boolean;
};

const DATED_MEMORY_RE = /(?:^|\/)memory\/\d{4}-\d{2}-\d{2}\.md$/;
const EVERGREEN_MEMORY_RE = /(?:^|\/)(MEMORY\.md|memory\.md)$/;
const EVERGREEN_SUBDIR_RE = /(?:^|\/)memory\/(?!.*\d{4}-\d{2}-\d{2}\.md$).+\.md$/;
const SESSION_RE = /(?:^|\/)sessions?\//i;
const CONFIG_RE = /(?:^|\/)(AGENTS\.md|SOUL\.md|USER\.md|TOOLS\.md|HEARTBEAT\.md|\.env|config\b)/i;
const REFERENCE_RE = /(?:^|\/)(docs?|reference|notes|README)\b/i;

export function classifyDocKind(relPath: string): DocKind {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (DATED_MEMORY_RE.test(normalized)) {
    return "daily-log";
  }
  if (EVERGREEN_MEMORY_RE.test(normalized)) {
    return "evergreen";
  }
  if (EVERGREEN_SUBDIR_RE.test(normalized)) {
    return "evergreen";
  }
  if (SESSION_RE.test(normalized)) {
    return "session";
  }
  if (CONFIG_RE.test(normalized)) {
    return "config";
  }
  if (REFERENCE_RE.test(normalized)) {
    return "reference";
  }
  return "unknown";
}

// ---------- Heading path extraction ----------

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/**
 * Given the full file content lines and a chunk's line range,
 * compute the heading breadcrumb trail active at the chunk start.
 */
export function extractHeadingPath(allLines: string[], chunkStartLine: number): string {
  const headings: Array<{ level: number; text: string }> = [];

  // Scan from the top of the file up to (but not including) the chunk start
  const scanEnd = Math.min(chunkStartLine - 1, allLines.length);
  for (let i = 0; i < scanEnd; i++) {
    const line = allLines[i] ?? "";
    const match = HEADING_RE.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Pop headings at same or deeper level
      while (headings.length > 0 && headings[headings.length - 1].level >= level) {
        headings.pop();
      }
      headings.push({ level, text });
    }
  }

  // Also check if the chunk itself starts with a heading
  if (chunkStartLine - 1 < allLines.length) {
    const firstChunkLine = allLines[chunkStartLine - 1] ?? "";
    const match = HEADING_RE.exec(firstChunkLine);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      while (headings.length > 0 && headings[headings.length - 1].level >= level) {
        headings.pop();
      }
      headings.push({ level, text });
    }
  }

  return headings.map((h) => h.text).join(" > ");
}

// ---------- Section type classification ----------

const CODE_FENCE_RE = /^```/;
const LIST_ITEM_RE = /^\s*[-*+]\s|^\s*\d+\.\s/;
const FRONTMATTER_RE = /^---\s*$/;

export function classifySectionType(chunkText: string): SectionType {
  const lines = chunkText.split("\n");
  if (lines.length === 0) {
    return "unknown";
  }

  const firstLine = lines[0].trim();

  // Check if chunk starts with frontmatter
  if (FRONTMATTER_RE.test(firstLine) && lines.length > 1) {
    return "frontmatter";
  }

  // Check if chunk starts with a heading
  if (HEADING_RE.test(firstLine)) {
    return "heading";
  }

  // Count line types
  let codeLines = 0;
  let listLines = 0;
  let proseLines = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    if (CODE_FENCE_RE.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      codeLines++;
      continue;
    }
    if (inCodeBlock) {
      codeLines++;
    } else if (LIST_ITEM_RE.test(line)) {
      listLines++;
    } else if (line.trim().length > 0) {
      proseLines++;
    }
  }

  const total = codeLines + listLines + proseLines;
  if (total === 0) {
    return "unknown";
  }

  if (codeLines / total > 0.5) {
    return "code";
  }
  if (listLines / total > 0.5) {
    return "list";
  }
  return "prose";
}

// ---------- Signal detection ----------

const DECISION_SIGNALS =
  /\b(decided|decision|chose|choice|agreed|resolved|concluded|verdict|ruling)\b/i;
const RULE_SIGNALS =
  /\b(rule|must|always|never|require|forbidden|mandatory|constraint|guideline|policy)\b/i;
const STATUS_SIGNALS =
  /\b(status|progress|update|completed|done|finished|blocked|pending|in.?progress|milestone)\b/i;
const RESUME_SIGNALS =
  /\b(resume|continue|pick.?up|left.?off|next.?step|todo|remaining|backlog)\b/i;

export function detectSignals(text: string): ChunkSignals {
  return {
    containsDecision: DECISION_SIGNALS.test(text),
    containsRule: RULE_SIGNALS.test(text),
    containsStatus: STATUS_SIGNALS.test(text),
    containsResume: RESUME_SIGNALS.test(text),
  };
}

// ---------- Full metadata extraction ----------

export function buildChunkMetadata(params: {
  relPath: string;
  allLines: string[];
  chunkStartLine: number;
  chunkText: string;
}): ChunkMetadata {
  return {
    docKind: classifyDocKind(params.relPath),
    headingPath: extractHeadingPath(params.allLines, params.chunkStartLine),
    sectionType: classifySectionType(params.chunkText),
    signals: detectSignals(params.chunkText),
  };
}
