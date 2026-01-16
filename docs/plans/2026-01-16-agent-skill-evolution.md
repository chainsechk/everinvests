# Agent and Skill Evolution Implementation Plan

Date: 2026-01-16
Status: In Progress (Phase 0-1 complete, Phase 2 partial)
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

## Phase 2: Data Quality and Rate-Limit Resilience (In Progress)

Scope: Improve data completeness and stability under API limits.

Tasks:
- [ ] Add worker/src/cache/ttl.ts and use for:
  - TwelveData quote, sma, rsi
  - AlphaVantage macro calls
- [x] Add worker/src/quality/checks.ts:
  - missing assets
  - [ ] outlier values (pending)
  - [ ] stale timestamps (pending)
- [x] Write quality_flags into signals.output_json:
  - missing_assets, macro_fallback
  - [ ] stale_assets (pending)
- [x] Add UI labels in:
  - src/components/SignalDetail.astro
  - [ ] src/components/AssetTable.astro (pending - only detail view shows flags)
- [ ] Add tests for quality check thresholds.

Acceptance:
- [x] Partial data is visible in the UI (SignalDetail shows quality flags).
- [x] Runs record quality flags and do not silently pass.

## Phase 3: Prompt Registry and LLM Provenance (2 to 3 weeks)

Scope: Make LLM evolution controlled and auditable.

Tasks:
- Add worker/src/llm/prompts.ts with versioned prompt templates.
- Add D1 migration 0003_llm_provenance.sql:
  - prompt_versions(id, name, version, template, created_at)
  - llm_runs(id, signal_id, prompt_version_id, model, tokens_in, tokens_out, latency_ms, status, error_msg)
- Update worker/src/llm/summary.ts to:
  - record prompt version and model
  - enforce output checks (length, tone, forbidden phrases)
  - mark fallback reason in output_json
- Add scripts/eval-llm.ts with a small golden dataset.

Acceptance:
- Every summary is traceable to a prompt version and model.
- Prompt changes can be evaluated before rollout.

## Phase 4: Programmatic SEO Expansion (2 to 3 weeks)

Scope: Increase indexable pages and structured data.

Tasks:
- Add per-signal pages:
  - src/pages/[category]/[date]/[time].astro
- Add per-asset pages:
  - src/pages/stocks/[ticker].astro
  - src/pages/crypto/[ticker].astro
  - src/pages/forex/[pair].astro
- Add JSON-LD for:
  - WebSite, Article, and FinancialProduct
- Expand sitemap in src/pages/sitemap.xml.ts:
  - Include recent signal pages and asset pages.
- Add internal linking blocks:
  - "Related signals" and "Recent changes".

Acceptance:
- New page types appear in sitemap.
- Pages render correctly for data present in D1.

## Phase 5: Distribution and Engagement Loops (2 weeks)

Scope: Increase retention and sharing.

Tasks:
- Add "delta since last update" computation in worker/src/signals/.
- Render deltas in history list and detail pages.
- Add daily digest summary skill and optional email capture page.
- Add UTM tags for Telegram CTA links and track them.

Acceptance:
- Each signal shows delta vs previous signal.
- Digest skill runs on schedule and logs results.

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

