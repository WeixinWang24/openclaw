import { describe, expect, it } from "vitest";
import {
  classifyDocKind,
  extractHeadingPath,
  classifySectionType,
  detectSignals,
  buildChunkMetadata,
} from "./chunk-metadata.js";

describe("classifyDocKind", () => {
  it("classifies dated memory files as daily-log", () => {
    expect(classifyDocKind("memory/2026-03-20.md")).toBe("daily-log");
    expect(classifyDocKind("./memory/2025-01-15.md")).toBe("daily-log");
  });

  it("classifies MEMORY.md as evergreen", () => {
    expect(classifyDocKind("MEMORY.md")).toBe("evergreen");
    expect(classifyDocKind("memory.md")).toBe("evergreen");
  });

  it("classifies non-dated memory subdir files as evergreen", () => {
    expect(classifyDocKind("memory/projects.md")).toBe("evergreen");
    expect(classifyDocKind("memory/long-term/decisions.md")).toBe("evergreen");
  });

  it("classifies session files", () => {
    expect(classifyDocKind("sessions/abc123.jsonl")).toBe("session");
    expect(classifyDocKind("session/transcript.md")).toBe("session");
  });

  it("classifies config files", () => {
    expect(classifyDocKind("AGENTS.md")).toBe("config");
    expect(classifyDocKind("SOUL.md")).toBe("config");
    expect(classifyDocKind("USER.md")).toBe("config");
    expect(classifyDocKind("TOOLS.md")).toBe("config");
  });

  it("classifies reference files", () => {
    expect(classifyDocKind("docs/guide.md")).toBe("reference");
    expect(classifyDocKind("reference/api.md")).toBe("reference");
  });

  it("returns unknown for unrecognized paths", () => {
    expect(classifyDocKind("random/file.txt")).toBe("unknown");
  });
});

describe("extractHeadingPath", () => {
  it("returns empty for no headings", () => {
    const lines = ["Hello", "World", "No headings here"];
    expect(extractHeadingPath(lines, 2)).toBe("");
  });

  it("returns single heading", () => {
    const lines = ["# Title", "Content here", "More content"];
    expect(extractHeadingPath(lines, 2)).toBe("Title");
  });

  it("returns nested heading path", () => {
    const lines = [
      "# Top",
      "## Section A",
      "### Sub A1",
      "Content under Sub A1",
      "## Section B",
      "Content under Section B",
    ];
    expect(extractHeadingPath(lines, 4)).toBe("Top > Section A > Sub A1");
    expect(extractHeadingPath(lines, 6)).toBe("Top > Section B");
  });

  it("handles heading at chunk start", () => {
    const lines = ["# Title", "## Section", "Content"];
    expect(extractHeadingPath(lines, 2)).toBe("Title > Section");
  });

  it("pops deeper headings when a shallower one appears", () => {
    const lines = ["# H1", "## H2", "### H3", "## H2b", "Content"];
    expect(extractHeadingPath(lines, 5)).toBe("H1 > H2b");
  });
});

describe("classifySectionType", () => {
  it("detects heading sections", () => {
    expect(classifySectionType("# A heading\nSome text")).toBe("heading");
  });

  it("detects list sections", () => {
    expect(classifySectionType("- item one\n- item two\n- item three")).toBe("list");
  });

  it("detects code sections", () => {
    expect(classifySectionType("```js\nconst x = 1;\nconsole.log(x);\n```")).toBe("code");
  });

  it("detects prose sections", () => {
    expect(classifySectionType("This is a paragraph of text.\nIt has multiple sentences.")).toBe(
      "prose",
    );
  });

  it("detects frontmatter", () => {
    expect(classifySectionType("---\ntitle: Hello\ndate: 2026-01-01\n---")).toBe("frontmatter");
  });
});

describe("detectSignals", () => {
  it("detects decision signals", () => {
    const signals = detectSignals("We decided to use TypeScript for the project.");
    expect(signals.containsDecision).toBe(true);
  });

  it("detects rule signals", () => {
    const signals = detectSignals("You must always validate input at boundaries.");
    expect(signals.containsRule).toBe(true);
  });

  it("detects status signals", () => {
    const signals = detectSignals("Migration is completed and in production.");
    expect(signals.containsStatus).toBe(true);
  });

  it("detects resume signals", () => {
    const signals = detectSignals("Next step: pick up the API refactor.");
    expect(signals.containsResume).toBe(true);
  });

  it("returns all false for neutral text", () => {
    const signals = detectSignals("The quick brown fox jumps over the lazy dog.");
    expect(signals.containsDecision).toBe(false);
    expect(signals.containsRule).toBe(false);
    expect(signals.containsStatus).toBe(false);
    expect(signals.containsResume).toBe(false);
  });
});

describe("buildChunkMetadata", () => {
  it("combines all metadata for a daily log chunk", () => {
    const lines = ["# 2026-03-20", "## Morning", "- Decided to refactor auth module"];
    const meta = buildChunkMetadata({
      relPath: "memory/2026-03-20.md",
      allLines: lines,
      chunkStartLine: 3,
      chunkText: "- Decided to refactor auth module",
    });
    expect(meta.docKind).toBe("daily-log");
    expect(meta.headingPath).toBe("2026-03-20 > Morning");
    expect(meta.sectionType).toBe("list");
    expect(meta.signals.containsDecision).toBe(true);
  });
});
