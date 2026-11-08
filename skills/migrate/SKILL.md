---
name: migrate
description: Plan and carry out a minimal, honest migration of an existing third-party DSH plugin onto this kit's cleanup scopes and shared admission coordinator — preserving the original, keeping its licence, and labelling every evidence layer. Use before changing any third-party plugin source.
---

# migrate

Move an existing third-party DSH plugin onto this kit without turning "read the
source" into "it works". Read-only survey first, then a minimal diff, then
evidence that names exactly what was observed.

Design context: [plugin migration tech plan](../../docs/requirements-and-design/2026-11-06-plugin-migration-tech-plan.md)
and the run records under [`../../docs/testing/`](../../docs/testing/).

## Before any step

- Each execution step needs its own explicit instruction. A previous
  authorization, an earlier run or "we already copied it once" is **not**
  authorization for a new step.
- Under a sandbox, verify and record the hard caps before running: 768 MiB
  memory, swap 0, `TasksMax=32`, CPU quota 50%, `Type=exec`, 120 s,
  `node --max-old-space-size=384`, a single-use 1200 MiB `MemAvailable` gate,
  offline network and one writable directory. Run serially; on failure stop and
  keep the partial artifacts. No automatic retry, install or repair.
- Do not install, publish or touch a production profile in this phase.

## 1. Survey (read-only)

- Never import, install or execute an unknown plugin to "just get static
  information" — importing runs its top-level code.
- Read files: entry point, `package.json`, `cordis.patch.yml`, tests, `LICENSE`.
- Record provenance as bytes, not claims: repo URL, commit SHA, archive
  `sha256`, file count, byte count. An archive hash identifies bytes; it does
  **not** prove the commit is authentic or that the checkout is unmodified.

## 2. Preserve the original

- Copy to a **separate tree**; never edit the upstream copy. The original stays
  byte-identical and keeps its own tests.
- Keep every `LICENSE`/`COPYING` file verbatim (a package `license` field is
  metadata, not the licence text).
- Add `NOTICE` beside the copy: upstream name, commit, licence, the exact files
  changed and a one-line reason each. If you edit both `src/` and a
  hand-maintained `lib/`, say they are edited directly and that no build step
  proves they agree.

## 3. Minimal change: keep it a plugin

Keep the original `name`, `inject`, `Config`, `apply` shape, tool names and
registration calls. Change lifetime handling only.

- Keep async loading async; do not convert a dynamic `import()` to a static one
  to make a cleanup synchronous.
- Create one cleanup scope **inside each `apply`**, after loading succeeded and
  before the first registration — never at module scope, never shared between
  activations. With this kit: `createCleanupScope({ label })`, then
  `scope.defer(nativeDisposer, { label })` immediately after each acquisition.
- If the migrated `apply` returns a cleanup, it must be non-constructible (a
  `const` arrow, or `async`): a constructible callback is invoked with `new` and
  the cleanup it returns is discarded. An `apply` that returns nothing may keep
  its original form — the default `host-tool` template is a plain `function`.
  A class-based or otherwise constructible plugin that must start returning a
  cleanup therefore needs an explicit, documented minimal change plus a test,
  not a blanket rewrite and not a blanket prohibition.
- On failure, the Toolkit copy restores a patched host method before
  `await scope.close()`, then throws. That ordering is a **choice with an
  observable difference**, not a universal rule: if you do otherwise, say what
  is observable and test it.
- Wrap the original failure so both identities survive: a plain `Error` with
  `cause` when cleanup was clean, a standard `AggregateError` with the primary
  error first when it was not. Do not mutate or attach fields to the thrown
  value, and do not put `String(primary)` into the message.
- Do not add `ctx.effect()` to own what the host already owns.
- If a resource has several parts, prefer `registerManagedResource(ports, {
  label })` with synchronous ports returning the host's own disposer; `close()`
  is idempotent, single-promise and has **no timeout**.

## 4. Claims: one coordinator per coordination domain

Only if the plugin must not double-register a `(kind, name, scope)` tuple:

- Create **one coordinator per coordination domain** — every participant that
  must agree on the same names — and pass that instance to all of them. Not one
  per process by definition, and never one per plugin: a private table makes the
  coordination decorative.
- Claims are exactly `{ kind, name, scope }` with `kind` `'tool'` or `'service'`
  and already-trimmed strings. A `route` has no `kind`; do not fabricate one.
- Publish with `createAdmissionProvider(coordinator)`; the plugin injects
  `pluginAdmission` and stays PENDING until something provides it. The provider
  never creates, copies or wraps a coordinator, and unloading it unregisters the
  service — that is not a claim release.
- `reserve()` is synchronous and all-or-nothing. `admit(claims, activate)`
  reserves first, and releases only after a **clean** settlement of every
  deferred cleanup; a cleanup failure rejects with the scope aggregate. A
  throwing activation always quarantines.
- Quarantine has **no release API**: there is no force-clear, no expiry and no
  timeout. Do not imply that "proving the effect is gone" can clear it through
  this module. Recovery needs a separately reviewed host-level procedure; this
  helper provides none. A fresh coordinator, reload or restart alone does not
  prove that prior effects are gone.

## 5. Evidence by what was observed

Organise results by observation, not as a ladder of ever-stronger proofs:

- **Files and hashes** — what the source says; nothing about loading.
- **Module-level** — the real module imported against the real `defineTool` with
  a recording `ctx.tools.register`. Registration and rollback shape only.
- **Real Loader composition** — this *is* host integration: a real boot, tool
  identity compared before and after, disable and enable observed. A pending
  plugin is a state, not a failure.
- **Installed, running host** — evidence for the scenarios actually exercised
  on that build and configuration. Installation is not inherently stronger than
  an isolated real Loader test, and neither establishes "works generally".

Never upgrade one layer into another, and never let a skipped check read as a
pass.

## 6. Counting and generalization

- A differential suite compares two trees per case: "6/6" means six
  *comparisons*, not six passes per tree. Do not restate it as "both trees 6/6".
- A fixture-validated resolver or route primitive is evidence for that fixture
  only. Keep it single-purpose and do not cite it as a general rule.

## 7. Writing it down

Write the run record before summarizing: exact command, envelope and caps,
raw exit codes separately from interpretation, hashes of every fixed input,
terminal state, and every deviation. If the project imports the kit, the
dependency is a `file:` specifier written verbatim, and a relative path resolves
against the **generated package directory**, not your shell's working directory.
