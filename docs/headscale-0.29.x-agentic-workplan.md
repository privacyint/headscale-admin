# Headscale Admin — 0.29.x Feature Parity & Compliance Workplan (Agentic Execution)

## Purpose

This document is an **autonomous execution plan** for upgrading `headscale-admin` to align with Headscale `0.29.x` (especially `0.29.0` feature surface and `0.29.2` stability expectations).

It is designed for an agentic LLM with a large context window (~256k) to run with minimal supervision while preserving safety and quality.

---

## High-level objective

Deliver UI/API/test/docs support for:

1. **Policy compliance and non-destructive handling** for modern policy fields.
2. **Grants** (`src`, `dst`, `ip`, `app`, `via`, `srcPosture`) support in policy workflows.
3. **Node attributes** (`nodeAttrs`) and top-level `randomizeClientPort` support.
4. **SSH enhancements** (`check`, `checkPeriod`, `acceptEnv`) in policy UI.
5. **Auth approval workflows** via `/api/v1/auth/{approve,reject,register}`.
6. Documentation and test coverage appropriate for long-term maintenance.

---

## Repo context

- Project: `privacyint/headscale-admin`
- Stack: SvelteKit + Skeleton + TypeScript + Playwright + Vitest
- Existing API wrappers: `src/lib/common/api/*`
- Existing policy model is ACL-centric: `src/lib/common/acl.svelte.ts`
- Existing policy UI: `src/routes/acls/*`, `src/lib/cards/acl/*`
- Existing mock server for E2E: `e2e/mock-api.mjs`

---

## Operational guardrails (global)

## ✅ Must-do rules

- Preserve existing behaviour unless explicitly changed by this plan.
- Keep changes incremental and phase-scoped.
- Ensure policy load/save is **lossless** for fields not currently modelled.
- Keep feature flags or compatibility checks where uncertainty exists.
- Write tests with each feature slice (unit + e2e where applicable).
- Keep UI safe-by-default (no destructive overwrite without warning).

## ❌ Must-not rules

- Do **not** silently drop unknown policy fields on save.
- Do **not** combine unrelated refactors with feature delivery.
- Do **not** break ACL-only workflows while adding grants support.
- Do **not** rely on brittle regex-only transformations for core policy migration.

## Security / privacy / safety

- Never log or commit secrets/API keys.
- Use mock/synthetic values only in test fixtures.
- Keep error messaging informative but not secret-revealing.

---

## Branching and delivery strategy

- Create one PR per phase (or per large sub-phase), in order.
- Suggested branch naming:
  - `feat/policy-lossless-model`
  - `feat/policy-grants-nodeattrs`
  - `feat/ssh-check-auth-workflow`
  - `docs-tests/0.29-coverage`

Each PR should include:

- Summary of scope
- Test evidence
- Screenshots for UI changes
- Explicit non-goals

---

## Definition of done (global)

The initiative is complete when all are true:

- Policy editor can round-trip modern policy documents without field loss.
- Grants and nodeAttrs are editable in UI and saved correctly.
- SSH `check` mode fields are editable and validated.
- Admin auth actions are exposed with usable UX.
- README/docs updated for new workflows and caveats.
- Unit + e2e tests cover new flows with stable mocks.

---

## Phase 0 — Safety patch (non-destructive policy handling)

## Goal

Stop destructive policy saves immediately while laying foundation for richer model support.

## Why this phase first

Current ACL-centric serialisation can remove `grants`, `nodeAttrs`, and other 0.29+ fields.

## Scope

- Add a policy document abstraction that preserves unknown fields.
- Add explicit warning UX if user edits only ACL sections while document has unsupported fields.
- Prevent silent destructive writes.

## Subtasks

- [ ] Introduce a `PolicyDocument` type/module (new file, recommended `src/lib/common/policy-document.ts`).
- [ ] Implement parse/serialise utilities preserving full document.
- [ ] Add compatibility guard in save path (`src/routes/acls/Config.svelte` and related save flows).
- [ ] Add UI warning banner when policy contains fields outside legacy ACL set.
- [ ] Add unit tests: parse → serialise round-trip should preserve exact JSON structure (except formatting).

## Acceptance criteria

- Saving policy no longer removes unknown top-level or nested fields.
- User receives visible warning before potentially partial edits.
- Unit tests cover round-trip with mixed ACL+grants documents.

## Artifacts

- New policy document utility module
- Updated save/load flow
- Unit tests for lossless handling

---

## Phase 1 — Policy model modernisation (grants/nodeAttrs-ready)

## Goal

Introduce first-class policy structures for grants/nodeAttrs while removing legacy ACL compatibility.

## Scope

- Expand model layer to include:
  - `grants`
  - `nodeAttrs`
  - `tests`
  - `sshTests`
  - `postures` (at least pass-through, ideally editable)
  - `randomizeClientPort`
- Remove Legacy ACL options

## Subtasks

- [ ] Define TS types for modern policy sections (`src/lib/common/policy-types.ts`).
- [ ] Replace or adapt `ACLBuilder` into broader `PolicyBuilder` (or add bridge layer).
- [ ] Ensure  ACL tabs still function from same source-of-truth document.
- [ ] Add conversion helpers where needed (ACL rule ↔ grant-like representation for UI convenience, optional).
- [ ] Add unit tests for schema typing and mutation operations.

## Guardrails

- Replace/redesign ACL section in WebUI from scratch if required.
- Do not block valid policy files that include fields not yet edited by UI.

## Acceptance criteria

- Internal state supports modern policy structures.
- Tests should accomodate new PolicyBuilder with appropriate test that mimic the exisiting ones in the new framework

---

## Phase 1.5 — Policy architecture stabilisation (de-spaghetti bridge)

## Goal

Reduce coupling before Phase 2/3 feature expansion so grants/nodeAttrs/SSH/auth work lands on maintainable foundations.

## Why this phase now

Phase 1 introduces modern fields, but legacy ACL-centric code paths still concentrate model, serialisation, and UI-side effects in large modules. Without this clean-up, later phases risk compounding complexity and regressions.

## Scope

- Extract pure policy domain operations from UI/runtime concerns.
- Introduce a thin editor/store boundary for Svelte reactivity.
- Keep ACL tabs fully functional during migration.
- Preserve lossless round-trip guarantees from Phase 0/1.

## Subtasks

- [ ] Split `src/lib/common/acl.svelte.ts` into:
  - pure policy domain modules (validation/mutations/normalisation)
  - UI-facing editor/store wrapper
  - persistence adapter(s) for API save/load
- [ ] Add `PolicyBuilder` as first-class implementation (bridge adapter may remain temporarily for ACL UI compatibility).
- [ ] Move toast/loading side-effects out of core model layer into route/component handlers.
- [ ] Add targeted unit tests for extracted pure modules (including invariants and mutation edge cases).
- [ ] Keep old ACL component contracts stable until Phase 2 UI replacement is complete.

## Guardrails

- No behaviour changes to existing ACL workflows.
- No destructive policy writes.
- Keep changes incremental; avoid broad visual/UI rewrites in this phase.

## Acceptance criteria

- Core policy logic is testable without Svelte runtime.
- Model modules are materially smaller and responsibility-separated.
- Existing ACL tabs continue to work unchanged from user perspective.
- CI-equivalent local checks pass before merge.

---

## Phase 2 — Grants and nodeAttrs UX

## Goal

Deliver production-ready UI editing for grants + nodeAttrs + randomizeClientPort.

## Scope

- New tabs or sub-tabs in policy area:
  - Grants
  - Node Attributes
  - Maintain view of raw json section
- Support fields:
  - Grants: `src`, `dst`, `ip`, `app`, `via`, `srcPosture`
  - NodeAttrs: `target`, `attr`
  - Top-level: `randomizeClientPort`

## Subtasks

- [ ] Implement grants list/card components (`src/lib/cards/acl/` or new `policy/` namespace).
- [ ] Implement nodeAttrs list/card components.
- [ ] Add selectors/autocomplete reuse for users/groups/tags/hosts.
- [ ] Add capability editor UX for `app` map (JSON object array per capability key).
- [ ] Add via restrictions UX (tags only) with validation hints.
- [ ] Add top-level policy settings panel for `randomizeClientPort`.
- [ ] Add robust empty states and error handling.
- [ ] Add e2e coverage for create/edit/delete and persistence.

## Taildrive-specific direction

Include preset helpers for common Taildrive policy patterns:

- `nodeAttrs` presets:
  - `drive:share`
  - `drive:access`
- `grants.app` preset:
  - `tailscale.com/cap/drive` with `shares` and `access` entries.

## Acceptance criteria

- User can create and persist grants and nodeAttrs from UI.
- Saved document remains valid and lossless.
- Taildrive common setup is possible without raw JSON editing.

---

## Phase 3 — SSH check mode + auth action workflows

## Goal

Expose 0.29 SSH policy enhancements and admin approval actions.

## Scope

### SSH policy editor enhancements

- Add support for:
  - `action: accept|check`
  - `checkPeriod`
  - `acceptEnv`
- Keep current `src`/`dst`/`users` editing.

### Auth workflow actions

- Add API wrappers + UI actions for:
  - `POST /api/v1/auth/approve`
  - `POST /api/v1/auth/reject`
  - `POST /api/v1/auth/register`

## Subtasks

- [ ] Extend SSH rule TS types and builder methods.
- [ ] Update SSH rule components to include new fields and contextual help.
- [ ] Add validation and UX hints for check mode semantics.
- [ ] Add API wrapper functions in `src/lib/common/api`.
- [ ] Add admin action panel (minimal viable flow: auth ID + action controls).
- [ ] Add toast/error handling and optimistic refresh behaviour.
- [ ] Add e2e tests for happy/error paths via mock API.

## Acceptance criteria

- SSH check-mode policy rules can be created/edited/saved.
- Admin can perform auth approve/reject/register from UI.
- Tests cover API interaction + validation behaviour.

---

## Phase 4 — Documentation and test hardening

## Goal

Bring docs and automated coverage to release quality.

## Scope

- README updates for new policy and auth capabilities.
- Expanded mock fixtures and stable deterministic tests.
- Regression matrix for legacy + new policy formats.

## Subtasks

- [ ] Update README sections:
  - ACL Builder → Policy Builder positioning
  - Grants/nodeAttrs usage
  - SSH check workflow
  - Taildrive configuration examples
- [ ] Extend `e2e/mock-api.mjs` for auth endpoints and richer policy fixtures.
- [ ] Add e2e suites:
  - policy round-trip non-destructive
  - grants/nodeAttrs CRUD
  - ssh check fields
  - auth actions
- [ ] Add unit tests for policy utils and validators.
- [ ] Add maintenance notes for future API evolution.

## Acceptance criteria

- Docs are sufficient for a new maintainer to use new features.
- CI test suites cover both old and new policy workflows.
- Mock API supports all new UI flows deterministically.

---

## Agent execution protocol (recommended)

Use this per phase:

1. Read phase scope + subtasks.
2. Implement smallest viable slice.
3. Run targeted tests.
4. Fix issues.
5. Update/add tests.
6. Commit with concise scope message.
7. Produce PR summary with:
   - What changed
   - Why
   - Tests run
   - Risks/known gaps

### CI parity rule (mandatory)

Before commit/push for any phase, run the same quality gates as `.github/workflows/ci.yml` in Docker and require pass status:

- `svelte-check`
- `vitest`
- `vite build` (+ static route verification where applicable)
- Docker image smoke build/check
- Playwright e2e (dev + docker config where applicable)

Local acceptance should match remote CI expectations; do not push if the CI-equivalent local run is red.

### Commit guidance

- One logical commit per subtask cluster.
- Avoid “mega commits”.
- Use explicit scope prefixes, e.g. `policy:`, `ssh:`, `auth:`, `docs:`.

---

## Quality gates by phase

- **Phase 0 gate:** lossless policy round-trip verified.
- **Phase 1 gate:** unified policy model with no ACL regressions.
- **Phase 2 gate:** grants/nodeAttrs functional in UI + tests.
- **Phase 3 gate:** ssh check + auth actions working + tests.
- **Phase 4 gate:** docs updated + regression coverage complete.

No later phase should start until current phase gate passes.

---

## Suggested execution order of files (for autonomous agents)

1. `src/lib/common/acl.svelte.ts` (or replacement policy model)
2. `src/routes/acls/Config.svelte`
3. `src/routes/acls/+page.svelte`
4. `src/lib/cards/acl/*` and new policy card components
5. `src/lib/common/api/*` (new auth wrappers)
6. `e2e/mock-api.mjs`
7. `e2e/*.spec.ts`
8. `README.md`

---

## Out-of-scope (for this initiative)

- Headscale 0.30 API migration work (OpenAPI 3.1 + RFC7807 behavioural rewrites).
- Full visual parity with Tailscale admin console.
- Non-policy unrelated refactors.

---

## Risk register

1. **Policy corruption risk** — mitigated by Phase 0 lossless layer and tests.
2. **UI complexity in grants.app editing** — mitigate with presets + raw JSON advanced editor.
3. **Validation drift vs server semantics** — keep server as source of truth; surface server errors clearly.
4. **E2E flakiness** — use deterministic mock fixtures and explicit waiting points.

---

## Handoff template (copy/paste for agent runs)

> Implement **Phase X** from `docs/headscale-0.29.x-agentic-workplan.md`.
> Respect scope and guardrails strictly.
> Keep changes minimal and phase-bound.
> Add/adjust tests for all new behaviour.
> Provide a short completion report with:
> - files changed
> - tests run and results
> - known limitations
> - follow-up recommendations

---

## Final note

This plan intentionally prioritises **data safety and compatibility first**, then feature expansion. That ordering is mandatory to avoid regressions on existing deployments using mixed or advanced policy documents.
