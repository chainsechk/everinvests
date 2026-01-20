# Agent and Skill Evolution Implementation Plan

Date: 2026-01-16
Status: In Progress (Phase 0-5 complete, Phase 6 next)
Baseline: Signal API Foundation and Frontend UI plans completed.

## Executive Summary

This plan evolves EverInvests from a fixed pipeline into a versioned, observable, and easily extensible agent-skill system. The goal is to ship new market analysis capabilities safely, with strong provenance, quality guardrails, and SEO growth. The worker becomes a workflow orchestrator that runs composable skills, while the site expands into programmatic content with structured data.

## Goals

- Add new skills without rewriting the worker or schema each time.
- Preserve provenance for every summary: model, prompt, latency, and fallback reason.
- Make data completeness explicit; avoid silent partial runs.
- Enable safe experimentation and rollback for prompts and skills.
- Expand SEO surface area with per-asset and per-signal pages.

## Non-Goals (this cycle)

- User accounts, personalization, or watchlists.
- Paid subscription handling or payments.
- Intraday alerts faster than the current schedule.

## Definitions

- Skill: A versioned unit of work with typed input and output (e.g., fetch macro data, compute bias, generate summary).
- Workflow: An ordered graph of skills with dependencies and conditional execution.
- Run: A single execution of a workflow for a category and time slot.

## Architecture Updates (Target)

Worker:
- worker/src/skills/ for modular skills.
- worker/src/workflows/ for per-category workflows.
- worker/src/pipeline.ts orchestrator.
- worker/src/quality/ for checks and flags.
- worker/src/cache/ for rate-limit friendly fetching.
- worker/src/llm/prompts.ts for prompt registry and versions.

Site:
- src/pages/[category]/[date]/[time].astro for per-signal pages.
- src/pages/stocks/[ticker].astro and similar for per-asset pages.
- Structured data and canonical consistency across all pages.

Data:
- Add workflow_runs and skill_runs tables for observability.
- Add prompt_versions and llm_runs tables for provenance and evaluation.
- Add quality flags to signal output_json for UI visibility.

## Phase 0: Baseline Alignment ✅ COMPLETE

Scope: Validate domain and baseline metrics before larger changes.

Tasks:
- [x] Confirm and centralize SITE_URL config in:
  - src/lib/site.ts (new central module)
  - src/layouts/BaseLayout.astro
  - src/pages/sitemap.xml.ts
  - src/pages/robots.txt.ts
  - worker/src/notify/telegram.ts (uses env.SITE_URL)
- [ ] Add scripts/baseline-report.ts (deferred - observability tables now provide this)
- [x] Update docs/development.md with baseline procedure.

Acceptance:
- [x] All site outputs use a single canonical domain.
- [x] Observability via workflow_runs and skill_runs tables replaces baseline report.

## Phase 1: Workflow Orchestrator and Skill Registry ✅ COMPLETE

Scope: Convert worker logic into modular skills and workflow configs.

Tasks:
- [x] Add worker/src/skills/types.ts with SkillSpec interface:
  - id, version, inputs, outputs, run()
- [x] Move existing logic into skills:
  - fetchMacroDataSkill
  - fetchAssetDataSkill
  - computeBiasSkill
  - qualityChecksSkill (added)
  - generateSummarySkill
  - storeSignalSkill
  - notifyTelegramSkill
- [x] Add worker/src/workflows/crypto.ts, forex.ts, stocks.ts.
- [x] Add worker/src/pipeline.ts to execute skills with dependency graph.
- [x] Add D1 migration 0002_agent_workflows.sql:
  - workflow_runs(id, workflow_id, category, date, time_slot, status, duration_ms)
  - skill_runs(id, workflow_run_id, skill_id, skill_version, status, duration_ms, error_msg)
- [x] Add tests for pipeline execution and dependency ordering.
- [x] Deploy worker and apply migration to production.

Acceptance:
- [x] All categories run through workflow configs.
- [x] A skill version can be swapped without code changes in other skills.
- [x] Workflow and skill runs recorded in D1 with timing data.

## Phase 2: Data Quality and Rate-Limit Resilience ✅ COMPLETE

Scope: Improve data completeness and stability under API limits.

Tasks:
- [x] Add worker/src/cache/ttl.ts and use for:
  - TwelveData quote, sma, rsi
  - AlphaVantage macro calls
- [x] Add worker/src/quality/checks.ts:
  - missing assets
  - [x] outlier values
  - [x] stale timestamps
- [x] Write quality_flags into signals.output_json:
  - missing_assets, macro_fallback
  - [x] stale_assets
  - [x] outlier_values
  - [x] macro_stale
- [x] Add UI labels in:
  - src/components/SignalDetail.astro
  - [x] src/components/AssetTable.astro (shows stale/outlier icons)
- [x] Add tests for quality check thresholds (20 tests in tests/worker/quality-checks.test.ts)

Acceptance:
- [x] Partial data is visible in the UI (SignalDetail and AssetTable show quality flags).
- [x] Runs record quality flags and do not silently pass.
- [x] TTL cache reduces API calls and improves rate limit resilience.
- [x] Outlier detection flags unusual values for review.

## Phase 3: Prompt Registry and LLM Provenance ✅ COMPLETE

Scope: Make LLM evolution controlled and auditable.

Tasks:
- [x] Add worker/src/llm/prompts.ts with versioned prompt templates.
  - Prompt registry with name/version lookup
  - Two prompt versions: v1 (original) and v2 (enhanced structure)
  - buildPromptFromRegistry() for dynamic prompt building
- [x] Add D1 migration 0003_llm_provenance.sql:
  - prompt_versions(id, name, version, template, created_at)
  - llm_runs(id, signal_id, prompt_version_id, model, tokens_in, tokens_out, latency_ms, status, error_msg, fallback_reason, created_at)
- [x] Update worker/src/llm/summary.ts to:
  - record prompt version and model
  - enforce output checks (length, tone, forbidden phrases)
  - mark fallback reason in output_json
  - sanitize outputs (remove emojis, markdown)
- [x] Add worker/src/llm/validation.ts with:
  - Length checks (30-300 chars, 5-60 words)
  - Forbidden patterns (fibonacci, MACD, disclaimers, NFA/DYOR)
  - Emoji and markdown detection
  - Sensational language warnings
- [x] Add scripts/eval-llm.ts with golden dataset (4 test cases).
- [x] Add tests for prompt registry (16 tests) and validation (26 tests).
- [x] Update generateSummarySkill to version 2 with provenance tracking.

Acceptance:
- [x] Every summary is traceable to a prompt version and model.
- [x] Prompt changes can be evaluated before rollout.
- [x] Output validation prevents low-quality summaries.

## Phase 4: Programmatic SEO Expansion ✅ COMPLETE

Scope: Increase indexable pages and structured data.

Tasks:
- [x] Add per-signal pages:
  - src/pages/[category]/[date]/[time].astro
  - Includes navigation (prev/next), breadcrumbs, and recent signals
- [x] Add per-asset pages:
  - src/pages/stocks/[ticker].astro
  - src/pages/crypto/[ticker].astro
  - src/pages/forex/[pair].astro
  - Each shows current status, signal history, and links to other assets
- [x] Add JSON-LD for:
  - WebSite and Organization (in BaseLayout for all pages)
  - Article (on per-signal pages)
  - FinancialProduct (on per-asset pages)
- [x] Expand sitemap in src/pages/sitemap.xml.ts:
  - Include recent signal pages (up to 500)
  - Include all asset pages (crypto, forex, stocks tickers)
- [x] Add internal linking blocks:
  - RelatedSignals component for cross-category linking
  - AssetTable now links each ticker to its detail page
  - HistoryMini and HistoryList link to signal detail pages

Acceptance:
- [x] New page types appear in sitemap.
- [x] Pages render correctly for data present in D1.

## Phase 5: Distribution and Engagement Loops ✅ COMPLETE

Scope: Increase retention and sharing via Telegram.

Tasks:
- [x] Add "delta since last update" computation in worker/src/signals/delta.ts.
  - Computes bias change, price deltas, biggest movers
  - Integrated into storeSignal skill (v2)
  - 8 unit tests for delta computation
- [x] Render deltas in history list and detail pages.
  - Added DeltaBadge component (compact and full variants)
  - Shows bias changes, top gainers/losers in HistoryList
  - Full delta section on signal detail pages
- [x] Add daily digest summary skill.
  - worker/src/digest/daily.ts aggregates daily signals
  - Scheduled at 23:00 UTC
  - Manual trigger via /send-daily-digest endpoint
- [x] Add UTM tags for Telegram CTA links.
  - Updated telegram.ts to include utm_source, utm_medium, utm_campaign
  - Links now point to signal detail pages with tracking

Acceptance:
- [x] Each signal shows delta vs previous signal.
- [x] Digest skill runs on schedule and logs results.

## Phase 6: Continuous Evolution Ops (ongoing)

Scope: Safe iteration, observability, and rollback.

Tasks:
- Add src/pages/api/status.ts for last runs and health checks.
- Add worker endpoint for manual backfill runs:
  - /trigger?category=...&date=...&time_slot=...
- Add docs/release.md with release checklist:
  - prompt changes, skill changes, rollback steps.
- Add scheduled eval job (nightly) for LLM quality metrics.

Acceptance:
- Backfill runs are possible without code changes.
- Release checklist exists and is used for prompt changes.

## Testing and Verification

- Worker unit tests: pipeline, skill execution, quality checks.
- API tests: status endpoint, per-signal pages data fetch.
- SEO checks: sitemap contains new URLs, canonical domain consistent.
- Manual checks: UI shows quality flags and delta summaries.

## Risks and Mitigations

- LLM drift: use prompt registry, evals, and fallbacks.
- API throttling: cache, backoff, sequential fetches with limits.
- SEO duplication: single canonical domain and consistent URL structure.

## Rollout Strategy

- Phase 1 and 2 behind a config flag in worker/src/config.ts.
- Phase 3 prompts staged using versioned rollout.
- Phase 4 SEO pages deployed after indexing-friendly sitemap changes.

