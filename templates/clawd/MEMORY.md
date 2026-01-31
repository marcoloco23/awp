---
awp: "0.4.0"
type: "memory-longterm"
lastCompacted: "2026-01-27T08:00:00.000Z"
entryCount: 5
pinnedCount: 2
---

# Long-Term Memory

*Curated memories, lessons learned, and important context that persists across sessions.*

---

## Pinned

### ResearchBot's Strengths and Weaknesses
*Pinned 2026-01-20*

ResearchBot excels at literature review and data analysis (epistemic-hygiene score: 0.91). Delegation works best when tasks are clearly scoped with explicit output formats. Coordination is the weakest dimension (0.78) — missed status updates occasionally. Always set explicit deadlines and check in proactively.

### AWP File Format Conventions
*Pinned 2025-12-15*

All workspace files use YAML frontmatter with `awp` version field. IDs follow `<type>:<slug>` pattern. Slugs are kebab-case derived from filenames. Timestamps are ISO 8601 UTC. Confidence scores range 0.0-1.0 and should be recalculated on every artifact update.

---

## Lessons Learned

### Reputation Signals Need Actionable Feedback
*2026-01-15*

Sending a reputation signal with just a score is not useful. Always include a `message` field with specific, actionable feedback. Example: "Missed one status update but recovered quickly" is better than just score: 0.75.

### Artifact Versioning Prevents Conflicts
*2025-12-20*

When two agents edit the same artifact, version conflicts arise. Solution: use monotonically increasing version numbers and provenance logs. The agent with the later timestamp wins ties, but both entries are preserved in provenance.

### Contract Evaluation Criteria Should Be Set Upfront
*2025-12-10*

Setting evaluation criteria after the work is done introduces bias. Always define `evaluation.criteria` with weights at contract creation time. The `evaluation.result` is filled in after the delegate completes the task.
