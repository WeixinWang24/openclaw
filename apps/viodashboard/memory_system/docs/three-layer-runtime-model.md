# Memory System Three-Layer Runtime Model (Draft v0.1)

This document maps the intended three-layer memory model onto the current `memory_system` MVP and the existing workspace guideline store.

## Goal

Turn the current memory tooling into a practical runtime memory system with three distinct layers:

1. **Rule layer** — frozen guidance, human-maintained
2. **Experience layer** — accumulated lessons, decisions, risks, and project evidence
3. **Short-term layer** — current active context, recent work state, and recovery memory

The key design rule is:

> Different layers have different write permissions, retention behavior, and retrieval priorities.

---

## Layer 1: Rule layer

### Purpose

Store durable behavioral rules and governance constraints that should guide runtime behavior but should **not** be auto-edited by the assistant.

### Source of truth

Workspace directory:

- `/Volumes/2TB/MAS/memory/permanent/guidelines`

### Authority model

- **Read:** assistant/runtime allowed
- **Write:** human-maintained only
- **Mutation policy:** frozen by default; no automatic edits, no automatic pruning, no silent sync-back

### Typical contents

- coding governance
- fork architecture guidance
- review templates
- architecture checklists
- stable operating rules

### Runtime usage

This layer should be loaded first and treated as **highest-priority guardrails**.

### Proposed runtime interface

- `getRuleLayer()`
- `summarizeRuleLayer()`

### Current implementation status

- Exists as files in workspace
- VioDashboard already has a read-only guideline API
- Not yet merged into a unified runtime memory context builder

---

## Layer 2: Experience layer

### Purpose

Store accumulated project experience that is not immutable law, but is worth reusing:

- lessons learned
- decisions
- retained risks
- status milestones
- known failure patterns
- linked artifacts for traceability

### Source of truth

SQLite under VioDashboard:

- `/Users/visen24/MAS/openclaw_fork/apps/viodashboard/memory_system/db/memory.db`

### Authority model

- **Read:** assistant/runtime allowed
- **Write:** assistant/runtime allowed under controlled paths
- **Mutation policy:** append-first, selective promotion, explicit deactivation instead of silent overwrite where possible

### Current table mapping

#### Primary tables
- `events` → raw experience/event stream
- `facts` → distilled lessons, decisions, stable takeaways
- `risks` → independently tracked risk memory
- `artifacts` → traceability links
- `daily_summaries` → review surface / day-level summaries

#### Interpretation by current schema
- `facts.scope = 'long_term'` → durable experience memory
- `facts.scope = 'audit'` → trace / governance support memory
- `events` recent subset → raw supporting evidence for recall

### Recommended semantic usage

#### `events`
Use for:
- session-level notable work
- design discussion outcomes
- debugging findings
- implementation milestones
- failure samples

#### `facts`
Use for:
- lessons
- decisions
- rules promoted from experience (not rule-layer governance files)
- retained patterns
- stable project status facts

#### `risks`
Use for:
- unresolved risks worth revisiting independent of prose events

### Runtime usage

This layer should be queried second, after rule-layer loading, and should answer:

- What did we learn before?
- What decisions already exist?
- What risks are still open?
- What evidence/artifacts support this?

### Proposed runtime interface

- `searchExperienceMemory(query, options)`
- `getRecentExperience(limit)`
- `getOpenRisks(limit)`
- `getDecisionMemory(query)`
- `buildExperienceContext(query)`
- `recordExperienceEvent(payload)`

### Current implementation status

- SQLite schema exists
- Ingest/query/export/migrate scripts exist and run
- Real data already exists
- No first-class runtime API yet
- No layer-aware retrieval policy yet

---

## Layer 3: Short-term layer

### Purpose

Store active and recent context needed for session recovery and near-term continuity:

- what is currently being worked on
- recent message/task context
- temporary assumptions
- pending next actions
- current phase of work

This layer should be cheap to update and cheap to discard or compact.

### Source of truth

Not fully implemented yet.

Recommended initial source-of-truth options:

#### Option A: SQLite-backed short-term facts/events
Use existing schema first:
- `facts.scope = 'short_term'`
- recent `events` with recent timestamp filters

#### Option B: SQLite + ephemeral runtime snapshot
- SQLite remains recovery store
- runtime process may keep an in-memory or JSON snapshot for active turn context

### Authority model

- **Read:** assistant/runtime allowed
- **Write:** assistant/runtime allowed
- **Mutation policy:** replace/expire/compact is acceptable; this is not frozen memory

### Typical contents

- active task status
- current hypothesis
- pending follow-ups
- recent session breadcrumbs
- session recovery memo

### Runtime usage

This layer should be loaded last and treated as **highest recency, lowest permanence**.

It answers:
- What are we doing right now?
- What was the immediate last state?
- What should be resumed first?

### Proposed runtime interface

- `getShortTermMemory()`
- `updateShortTermMemory(payload)`
- `compactShortTermMemory()`
- `buildRecoveryContext()`

### Current implementation status

- Conceptually supported by existing schema (`short_term` scope exists)
- No formal write/read API yet
- No expiry/compaction policy yet
- No dedicated runtime recovery builder yet

---

## Retrieval priority

At runtime, memory should be assembled in this order:

1. **Rule layer**
   - guardrails and governance
   - immutable during runtime
2. **Experience layer**
   - durable project memory
   - lessons, decisions, risks, evidence
3. **Short-term layer**
   - active and recent context
   - most recent, but not authoritative over rule layer

### Conflict rule

If layers disagree:
- Rule layer wins over all
- Human-maintained explicit rule/guideline wins over inferred experience
- Experience layer wins over short-term improvisation
- Short-term layer may override recency, but not governance

---

## Minimal runtime context builder

A first practical runtime builder should output something like:

### Rules
- condensed rule-layer bullets

### Relevant experience
- top lessons / decisions / risks matching the current task

### Current short-term state
- active task
- recent progress
- pending next steps

### Proposed interface

- `buildRuntimeMemoryContext({ query, includeRules=true, includeExperience=true, includeShortTerm=true })`

Return shape:

```json
{
  "rules": [...],
  "experience": {
    "facts": [...],
    "events": [...],
    "risks": [...]
  },
  "shortTerm": {
    "facts": [...],
    "events": [...]
  },
  "summary": "..."
}
```

---

## Implementation roadmap

### Phase 1 — already partially done
- rule-layer directory reader
- guideline summary extraction
- experience DB + scripts

### Phase 2 — next recommended step
- add a runtime experience API layer in VioDashboard
- expose read methods for:
  - recent experience
  - decisions/lessons
  - open risks
  - short-term facts/events

### Phase 3
- add write path for experience layer
- add explicit short-term memory write/update path
- add compaction/promote flow from short-term → experience

### Phase 4
- add unified runtime memory context builder
- inject built context into assistant flows when appropriate

---

## Immediate design decisions

1. **Rule layer stays outside SQLite**
   - because it is frozen and human-maintained
2. **Experience layer continues to use current SQLite MVP**
   - no schema rewrite required to proceed
3. **Short-term layer should first reuse existing schema**
   - start with `facts.scope='short_term'` and recent `events`
   - only add new tables if clearly necessary later
4. **Do not conflate rule memory with inferred rules in facts**
   - workspace guidelines are authoritative rules
   - SQLite `facts.fact_type='rule'` should be treated as experience-derived/project-local rule memory, not canonical governance files

---

## Current bottom line

The current system is already enough to support the following split:

- **Rule layer** → workspace guideline directory
- **Experience layer** → current SQLite memory system
- **Short-term layer** → to be formalized using `short_term` scope + recent events

This means the fastest path forward is **integration and runtime layering**, not a schema rewrite.
