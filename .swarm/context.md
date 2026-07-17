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
| bash | 546 | 546 | 0 | 6792ms |
| read | 483 | 483 | 0 | 19221ms |
| edit | 270 | 270 | 0 | 1702ms |
| write | 186 | 186 | 0 | 1804ms |
| grep | 60 | 60 | 0 | 1395ms |
| glob | 47 | 47 | 0 | 521ms |
| todowrite | 37 | 37 | 0 | 23ms |
| task | 20 | 20 | 0 | 428846ms |
| update_task_status | 15 | 15 | 0 | 211ms |
| gitingest | 12 | 12 | 0 | 10646ms |
| skill | 9 | 9 | 0 | 160ms |
| save_plan | 8 | 8 | 0 | 210ms |
| search | 7 | 7 | 0 | 127ms |
| phase_complete | 6 | 6 | 0 | 17475ms |
| retrieve_summary | 6 | 6 | 0 | 28ms |
| swarm_command | 5 | 5 | 0 | 74ms |
| fetch_get_markdown | 5 | 5 | 0 | 130ms |
| question | 4 | 4 | 0 | 72666ms |
| check_gate_status | 3 | 3 | 0 | 27ms |
| set_qa_gates | 2 | 2 | 0 | 72ms |
| dispatch_lanes | 2 | 2 | 0 | 84064ms |
| sequential-thinking_sequentialthinking | 2 | 2 | 0 | 59ms |
| websearch | 2 | 2 | 0 | 3082ms |
| invalid | 1 | 1 | 0 | 2ms |
| spec_write | 1 | 1 | 0 | 45ms |
| declare_scope | 1 | 1 | 0 | 8ms |
| summarize_work | 1 | 1 | 0 | 76ms |
| write_retro | 1 | 1 | 0 | 20ms |
| write_drift_evidence | 1 | 1 | 0 | 141ms |
| checkpoint | 1 | 1 | 0 | 573ms |
| web_fetch | 1 | 1 | 0 | 12ms |
| batch_symbols | 1 | 1 | 0 | 55ms |
| webfetch | 1 | 1 | 0 | 9754ms |
