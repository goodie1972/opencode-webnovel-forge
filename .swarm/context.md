# Context
Swarm: local

## Decisions
- [decision]: Use standard Node.js `path` module for validation where possible.
- [decision]: Use a configuration-driven approach for agent creation to eliminate boilerplate.
- [decision]: Keep `src/hooks/extractors.ts` near the hook logic because it needs access to the same hook utilities and shared state; document this rationale in the context file instead of moving it to `utils/`.
- [decision]: Retry behavior is a single, global setting (`fileRetryEnabled`) rather than per-operation toggles.
- [decision]: Markdown AST caching stays in-memory only (no disk persistence).
- [decision]: Default logging verbosity is `WARN`; debug-level logs enabled via env flag when needed.
- [decision]: Performance target: repeated markdown parse loops should stay under 500ms with caching.
- [decision]: Security posture is fail-secure; validation errors block further processing.

- [decision]: Run `scripts/check-records.ts` before linting so any `Record<string, unknown>` must include a `RECORD-JUSTIFIED` comment.
- [decision]: Enforce coverage >= 90% via `scripts/check-coverage.ts` before releasing.
## SME Cache
### typescript
- [guidance]: Document helper methods with `@param`/`@returns`, include accuracy remarks for estimators, keep helper modules single-responsibility (tokens vs. delegation), and guard map accesses with explicit `has` checks instead of optional chaining.
- [guidance]: Export a `PluginInitConfig` type for the config hook, guard `Map`/`Record` accesses with explicit `has`/`in` checks before `.get()`/`[...]`, and ensure logging helpers report missing configs rather than silently skipping.
### observability
- [guidance]: Use structured logs for initialization, record safe metadata (agent count, config keys, environment), include a startup banner at INFO, and make `LOG_LEVEL`/`VERBOSE_INIT` flags control DEBUG output while redacting secrets (keys ending in `_KEY`, `_SECRET`, `_TOKEN`).

## Patterns
- [pattern]: Agent factory pattern used in `src/agents/*.ts`

## Pending QA Gate Selection
- reviewer: true
- test_engineer: true
- sme_enabled: false
- critic_pre_plan: false
- sast_enabled: false
- council_mode: false
- hallucination_guard: false
- mutation_test: false
- phase_council: false
- drift_check: true
- final_council: false

## Agent Activity

| Tool | Calls | Success | Failed | Avg Duration |
|------|-------|---------|--------|--------------|
| read | 217 | 217 | 0 | 42567ms |
| bash | 127 | 127 | 0 | 4773ms |
| edit | 102 | 102 | 0 | 2573ms |
| write | 97 | 97 | 0 | 1012ms |
| grep | 36 | 36 | 0 | 2196ms |
| todowrite | 18 | 18 | 0 | 22ms |
| glob | 17 | 17 | 0 | 1112ms |
| update_task_status | 13 | 13 | 0 | 228ms |
| task | 7 | 7 | 0 | 83059ms |
| search | 7 | 7 | 0 | 127ms |
| save_plan | 6 | 6 | 0 | 200ms |
| phase_complete | 6 | 6 | 0 | 17475ms |
| gitingest | 4 | 4 | 0 | 2867ms |
| skill | 3 | 3 | 0 | 184ms |
| check_gate_status | 3 | 3 | 0 | 27ms |
| swarm_command | 3 | 3 | 0 | 80ms |
| retrieve_summary | 3 | 3 | 0 | 44ms |
| question | 2 | 2 | 0 | 109368ms |
| set_qa_gates | 2 | 2 | 0 | 72ms |
| dispatch_lanes | 2 | 2 | 0 | 84064ms |
| sequential-thinking_sequentialthinking | 2 | 2 | 0 | 59ms |
| invalid | 1 | 1 | 0 | 2ms |
| spec_write | 1 | 1 | 0 | 45ms |
| declare_scope | 1 | 1 | 0 | 8ms |
| summarize_work | 1 | 1 | 0 | 76ms |
| write_retro | 1 | 1 | 0 | 20ms |
| write_drift_evidence | 1 | 1 | 0 | 141ms |
| checkpoint | 1 | 1 | 0 | 573ms |
| fetch_get_markdown | 1 | 1 | 0 | 272ms |
| web_fetch | 1 | 1 | 0 | 12ms |
| batch_symbols | 1 | 1 | 0 | 55ms |
