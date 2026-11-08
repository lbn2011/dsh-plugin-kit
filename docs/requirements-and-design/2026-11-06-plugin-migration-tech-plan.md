# Plugin migration to `dsh-plugin-kit` — tech plan and reusable guide

> Version: v1.0　Date: 2026-11-06　Related: `projects/dsh-plugin-kit` (cleanup, managed-registration, admission), `experiments/third-party-pilots/*`
>
> **Decisions already taken (2026-11-06)**
> - **Migration is seam-level, not a rewrite.** Only the registration/teardown seam changes; bytes outside the edited regions are left alone. Because only a named set of files was compared, this is not a whole-tree guarantee.
> - **`createCleanupScope` was this migration's choice for Harbor's route seam.** That is a decision about this run, not a rule for route plugins: `registerManagedResource` can equally wrap a route plugin whose host ports return disposers synchronously. `admission` applies wherever a genuine `tool`/`service` claim exists.
> - **No route claim is fabricated.** The current schema has no route kind, so a route must not be passed off as a `tool` or a `service`. A route plugin's real tool/service claims are unaffected.
> - **Loader `fulfilled` is never treated as cleanup success.** Host teardown settling and a plugin's own cleanup scope closing cleanly are separate observations.
> - **Evidence classes never add up.** Simulated (fake host), unit, and real-Loader numbers are reported per class and per run.

## 1. How to read this guide

Three evidence classes appear throughout, and they are not interchangeable:

| Class | What it observes | What it cannot say |
| --- | --- | --- |
| Simulated (fake host) | Your seam against a host object you wrote | Nothing about the real Loader, real listeners or real hosts |
| Unit (`node --test`) | Mock gate-layer judgments, argument parsing, decision paths | Nothing about mounting, binding or disposing — and the class comes from what each file asserts, not from the runner |
| Real Loader | `app-boot` + Cordis + built host packages | Only the version, machine and date it ran on |

The two worked examples are **independent third-party plugins** (MIT, copyright held by their
own authors, not `deepseek-ai`): Harbor (`ZSeven-W/dsh-harbor`) and Toolkit
(`omdsh-dev/dsh-toolkit`). Neither is officially bundled. Experiment paths below are
reproducers, **not** an API: never copy an experiment path into a package as if it were a
dependency.

Pins of record: Harbor `9465c9fb36d753ae66d45a6617e4d51db8163df9`, Toolkit
`c3319d9d3e78a18191e1381461b69e84bc547575`, host checkout
`ce7073d51254c26cd63b22a60835b8f948deb447`. They fix *which tree* each observation is about;
they are not a claim that any archive was re-downloaded or byte-compared here. Every record
referenced below is linked from [Appendix A.3](#a3-evidence-records).

## 2. Current state

Both plugins already had a teardown path; neither used a shared settlement or an aggregation
policy.

| Block | Trigger | Current logic | Impact |
| --- | --- | --- | --- |
| Route registration (Harbor) | `apply(ctx)` → `mountHub` | Each route pushes its native disposer into a local `disposers` array, wrapped in a local `once()` | ✅ reusable; ❌ no shared promise, no aggregation |
| Unmount (Harbor) | returned teardown called | Synchronous `for` over `disposers` in reverse; returns `undefined` | ❌ caller cannot await; second call is a silent no-op |
| Disposer failure (Harbor) | disposer throws | `once()` catches and discards | ❌ failure invisible to the host |
| Tool registration (Toolkit) | first registration batch | Ten `ctx.tools.register` calls with a hand-written reverse loop and method restoration | ✅ order is right; ❌ no aggregate, no identity preservation |
| Rollback failure (Toolkit) | a registration throws | The primary error is wrapped in a new `Error` with no `cause` and no identity; cleanup errors during rollback were swallowed | ❌ primary identity lost; ❌ cleanup failures invisible |

The kit's actual contracts (read from source, not from docs):

- `createCleanupScope({ label })` — `cleanup.js:170`. `defer(disposer, {label})` at
  `cleanup.js:239` returns a frozen `{ label, done, release }`; `close()` at
  `cleanup.js:257` returns **one** settlement promise for every caller, assigned before the
  first disposer runs (`cleanup.js:265-267`). Deferring after close throws
  `CleanupScopeClosedError` / `ERR_CLEANUP_SCOPE_CLOSED` (`cleanup.js:121-133`); failures
  aggregate into an `AggregateError` with `ERR_CLEANUP_SCOPE_FAILED` (`cleanup.js:154-162`).
- `registerManagedResource(ports, {label})` — `managed-registration.js:450`. Ports:
  `register` (required), `subscribe`, `publish`, `deactivate`
  (`PORT_NAMES`, `managed-registration.js:144`); acquisitions run in a fixed order
  (`:159-163`) and `deactivate` is deferred last so LIFO unwinds it first (`:166`,
  `:486-490`). A **function** return is the host's disposer, exact identity, checked before
  `.then` (`:472-476`); a non-callable thenable is refused as an async acquisition (`:480-483`).
  The returned handle is frozen with an `active` flag that is explicitly *not* a fence
  (`:446-448`, `:503-505`).
- `createAdmissionCoordinator()` — `admission.js:537`. `CLAIM_KINDS` is exactly
  `['tool','service']` (`admission.js:230`); reservation is synchronous and conflict-checked
  before any mutation (`:554-576`); `admit()` releases claims only after a clean scope and
  **quarantines** them otherwise (`:731-753`).

## 3. Gap table

| # | Gap | Current state | Required by the migration |
| --- | --- | --- | --- |
| D1 | Shared teardown promise | Unmount returns `undefined` or a fresh chain | One promise, same object on repeat calls |
| D2 | Failure visibility | Disposer errors swallowed by local wrapper | Aggregate that names count and preserves thrown values |
| D3 | Reentrancy | Not observed in the originals — no claim is made about their behaviour | The new scope refuses `defer()` once `close()` started (`ERR_CLEANUP_SCOPE_CLOSED`) |
| D4 | Ordering | Hand-written reverse loop | LIFO documented as a contract, not a convention |
| D5 | Claim typing | The schema has no route kind | A route must not be fabricated into `tool`/`service`; real tool/service claims may still participate |
| D6 | Evidence separation | Run totals were being quoted across behaviours | Per-class, per-run reporting |
| D7 | Licence/provenance | MIT files exist, `package.json` is metadata only | Cite the LICENSE file, keep copyright |
| D8 | Normal-path claim | "13/13 passed" read as "no leak on unload" | Only the observed scenarios may be claimed |

## 4. Minimal-change decisions

### 4.1 Cleanup seam only (D1–D4)

Replace the local disposer array with one scope; replace the local wrapper with `defer`; return
`close()` directly. Keep the clearing of caches **before** returning, and do not cache the
promise in an outer variable — the scope already returns the same object.

```js
// before: disposers array + local once() + synchronous for-of
// after:
const scope = createCleanupScope({ label: '<plugin> routes' });
// registration:
scope.defer(dispose, { label: 'route:' + path });
// teardown:
let requested = false;
return () => {
  if (!requested) { requested = true; /* drop caches */ }
  return scope.close();
};
```

Measured effect (Harbor, simulated class): **one** differential suite of 6 cases, driven against
the original and the modified tree in the same run; 6/6 is that suite's result, not two
independent sixes and not something to double. The divergence it exposes is that a throwing
disposer becomes visible as an aggregate instead of disappearing, and that an async disposer is
awaited instead of being handed back synchronously.

### 4.2 Shared settlement (D1)

`close()` is the settlement. Do not build a second promise around it, do not `await` it inside
a disposer (self-deadlock risk), and do not treat `active`-style flags as mutual exclusion.

### 4.3 Native disposers (D2, D4)

Where synchronous acquisitions match the managed port model, `registerManagedResource`
can group their native disposers; otherwise a directly owned cleanup scope may suffice.
`TEARDOWN_ORDER` (`managed-registration.js:151`) orders only that handle's callbacks,
not the host's independent effects. Callable-first matters: a
Cordis `ctx.effect` disposer is a function *and* thenable, and must be taken as a function.

### 4.4 Admission has no route kind (D5)

`CLAIM_KINDS` is `['tool','service']` (`admission.js:230`): the current schema has **no route
kind**, so a route must not be passed off as a `tool` or a `service`. That is a gap in the
schema, not a ban on a route plugin using admission — the same plugin's genuine tool/service
claims can participate normally. Whether a route kind should exist is a separate schema
decision. And never rebuild the coordinator to route around a quarantine: a quarantined lease
holds its keys for the coordinator's lifetime by design (`admission.js:539-545`).

## 5. Applicability boundaries

| Primitive | Use when | Do not use when |
| --- | --- | --- |
| `createCleanupScope` | Any set of disposers you own; registration seams; route retraction | You need claim exclusion or host-visible ordering guarantees |
| `registerManagedResource` | Host returns one native disposer per acquired resource | The "resource" has no disposer, or acquisition is async (refused by design) |
| `createAdmissionCoordinator` | Two plugins could claim the same tool/service name | Fabricating a route/UI-slot/event claim the schema has no kind for |

Limits that stay true after migration: a never-settling disposer keeps `close()` pending
forever — there is **no deadline**; a disposer that awaits its own `close()` deadlocks; failures
inside `close()` are aggregated, **not retried**. Acceptance runs follow the same rule: one run,
no automatic retry, and a refusal stops the run rather than being worked around.

## 6. Original vs modified differential

Run the same driver against both trees, in one unit, serially. Report per case, never as a
sum across behaviours.

- **Harbor, simulated:** **one** differential suite of 6 cases (identity, normal reverse
  teardown, disposer throwing before retraction, async disposer gate, repeated/reentrant
  unmount, partial mount + guards), driven against the original and modified trees in the same
  run. 6/6 is that single suite's result — not two independent sixes. An earlier upstream
  baseline run reported 8/8 and is **historical reference only** — different test file, not
  additive with the 6.
- **Toolkit, simulated:** 13 custom records from a self-written sequential runner that prints
  `case=`/`summary=` lines. This is **not** `node --test` and **not** TAP; 13/13 is a custom
  count, not a framework result.

Both differentials prove behaviour under a host object the test wrote. Neither is Loader
evidence.

## 7. Real-Loader layered acceptance

| Layer | Example outcome | What it establishes |
| --- | --- | --- |
| Real boot, two scenarios | Harbor: 55/55 assertions (27 ids × 2 + `assertions_complete`) | Both trees mount, retract to a complete 404, and remount under a real Loader |
| Real boot under exemption | Toolkit: 2 scenarios, mount 10 tools → disable → re-enable (new identities) → teardown | The exemption is a **local experimental grant**, not native compatibility |
| Unit gates (mock gate-layer) | 83/83 `node --test` = **41 Harbor + 42 Toolkit** | Gate logic only; not addable to the numbers above, and not a statement that unit runs in general avoid disposal |

Rules that keep this honest:

- **83 ≠ 55 + 13 + 6.** Different files, different subjects; totals are per class and per run.
  The 83 are a **mock gate-layer** run: what makes them unit evidence is what each file
  asserts, not the runner that happened to execute them.
- **`teardown=fulfilled` means the fixture's dispose resolved.** The Loader catches a
  rejecting cleanup and only logs it
  ([`build-checkout/vendor/cordis/src/fiber.ts:712-730`](../../../../experiments/dsh-live-lab/build-checkout/vendor/cordis/src/fiber.ts#L712-L730)),
  so a fulfilled promise says nothing about individual cleanups.
- **A terminal unit is not an unload.** `LoadState=not-found`/`MainPID=0` proves the unit
  ended; it does not prove any plugin cleanup ran.
- **The Toolkit exemption is not a compatibility claim.** The plugin declares
  `>=0.0.1-rc.1 <0.2.0`, which does not admit the host's `0.2.2-alpha.2`; the grant was
  limited to two throwaway profiles, one date, one machine, and changed no manifest.
- **No tool body executed** in the Toolkit scenario: mount/disable/re-enable observe
  registration and disposal only — no permissions, sandbox policy or output guard.

Recommended order for a new plugin: simulated differential → unit gates → one real-Loader run
with an attested envelope (memory/swap/tasks/CPU/runtime), a single capacity gate, a private
network namespace, and a read-back of the applied caps inside the unit.

## 8. Rollback, licence and provenance

- **Rollback is file-level.** Keep the original tree untouched, keep the modified tree as a
  separate copy, and record hashes for a **named set** — never call that set a closure, a
  build proof, or evidence that `src` and `lib` agree. A hand-edited `lib/` next to an edited
  `src/` is two direct edits; their equivalence is unverified until a build is compared.
- **Source of truth for a third-party plugin is the pinned commit**, and a `git rev-parse HEAD`
  is a claim about the commit only — not about the working tree, ignored files or built output.
- **Licence evidence is the LICENSE file**, with the copyright line; `package.json` `license`
  is metadata. Keep the upstream LICENSE and NOTICE with any copy, and do not redistribute a
  partial subset as if it were the package (its `exports`/`bin` targets may not exist).
- **No auto-exemption, no publish, no install as part of migration.** Any exemption is an
  explicit, dated, local grant written through the host's own API.

## 9. Risks and pending items

| Risk | Why | Mitigation |
| --- | --- | --- |
| Reading Loader `fulfilled` as success | The host swallows cleanup rejections | Assert scope settlement separately; report both |
| Inferring "no leak on normal unload" | Only failing-path and mount scenarios were run | Say "not observed"; add a scenario before claiming |
| `src`/`lib` drift | Two hand edits, no build | Compare after a build, or label the tree as unbuilt |
| Subset copy mistaken for the package | `exports`/`bin` targets may be absent | Ship NOTICE; never install the subset |
| Cross-run number inflation | Different test files and subjects | Per-class tables only |
| Quarantine bypass temptation | A stuck claim looks like a bug | Fix the cleanup, not the coordinator |

**Pending / needs a decision**

1. Whether a route-shaped plugin should ever get a first-class claim kind. Not decided here:
   the schema has none, and the host does arbitrate route paths — `WebServer.register` refuses
   a duplicate `(kind, path)`
   ([`packages/host/webserver/src/index.ts:445-452`](../../../../experiments/dsh-live-lab/build-checkout/packages/host/webserver/src/index.ts#L445-L452)) —
   so this needs its own schema decision rather than a guess.
2. Whether normal-path unload needs its own real-Loader scenario (leaning: yes, before any
   "no leak" statement).
3. Whether the migration guide should ship a scaffold template for route plugins (leaning:
   after a second worked example).

## Appendix A: source quick reference

| Item | Location |
| --- | --- |
| Scope factory | [`src/cleanup.js:170`](../../src/cleanup.js#L170) (`createCleanupScope`) |
| Defer / refuse-after-close | [`src/cleanup.js:239`](../../src/cleanup.js#L239), [`src/cleanup.js:243`](../../src/cleanup.js#L243), [`src/cleanup.js:121-133`](../../src/cleanup.js#L121-L133) |
| Shared settlement | [`src/cleanup.js:257-276`](../../src/cleanup.js#L257-L276) (assigned at `:265-267`) |
| Aggregation | [`src/cleanup.js:154-162`](../../src/cleanup.js#L154-L162) (`closeFailure`), [`src/cleanup.js:217-233`](../../src/cleanup.js#L217-L233) (`drain`) |
| Managed ports / order | [`src/managed-registration.js:144`](../../src/managed-registration.js#L144), [`src/managed-registration.js:151-156`](../../src/managed-registration.js#L151-L156), [`src/managed-registration.js:159-166`](../../src/managed-registration.js#L159-L166) |
| Managed entry point | [`src/managed-registration.js:450`](../../src/managed-registration.js#L450) (`registerManagedResource`) |
| Callable-first | [`src/managed-registration.js:472-483`](../../src/managed-registration.js#L472-L483) |
| Claim kinds / coordinator | [`src/admission.js:230`](../../src/admission.js#L230), [`src/admission.js:537`](../../src/admission.js#L537) |
| Release vs quarantine | [`src/admission.js:731-753`](../../src/admission.js#L731-L753) |
| Host swallow point | [`build-checkout/vendor/cordis/src/fiber.ts:712-730`](../../../../experiments/dsh-live-lab/build-checkout/vendor/cordis/src/fiber.ts#L712-L730) (`_unload`, catch → `logger.error`) |
| Host duplicate-path refusal | [`build-checkout/packages/host/webserver/src/index.ts:445-452`](../../../../experiments/dsh-live-lab/build-checkout/packages/host/webserver/src/index.ts#L445-L452) (`register`) |
| Harbor worked example | [`experiments/third-party-pilots/harbor-modified/`](../../../../experiments/third-party-pilots/harbor-modified/) (differential) |
| Toolkit worked example | [`experiments/third-party-pilots/toolkit-rollback-modified/`](../../../../experiments/third-party-pilots/toolkit-rollback-modified/) (differential) |

### A.2 Plugin pins (as recorded, not re-downloaded)

| Plugin | Upstream commit pinned in the records |
| --- | --- |
| Harbor `@zseven-w/dsh-harbor` | `9465c9fb36d753ae66d45a6617e4d51db8163df9` |
| Toolkit `@deepseek-ai/dsh-toolkit` | `c3319d9d3e78a18191e1381461b69e84bc547575` |

Both are the pins the isolated copies were made from. This document does not claim to have
downloaded those archives again or to have verified byte equality with the commits; the pins
fix which tree the evidence is about.

### A.3 Evidence records

| Record | Subject |
| --- | --- |
| [2026-11-05-harbor-baseline.md](../testing/2026-11-05-harbor-baseline.md) | Upstream Harbor teardown behaviour, 8/8 (historical reference) |
| [2026-11-05-harbor-modified.md](../testing/2026-11-05-harbor-modified.md) | The 6-case differential suite |
| [2026-11-05-toolkit-baseline.md](../testing/2026-11-05-toolkit-baseline.md) | Upstream Toolkit baseline |
| [2026-11-05-toolkit-rollback-modified.md](../testing/2026-11-05-toolkit-rollback-modified.md) | The 13 custom records |
| [2026-11-06-toolkit-loader-exemption.md](../testing/2026-11-06-toolkit-loader-exemption.md) | Toolkit real-Loader run under the exact-version exemption |
| [2026-11-06-harbor-loader-path-gates-recheck.md](../testing/2026-11-06-harbor-loader-path-gates-recheck.md) | Harbor real-Loader run, 55 assertions |
| [2026-11-06-harbor-path-gates-unit.md](../testing/2026-11-06-harbor-path-gates-unit.md) | The 83-case mock gate-layer run (41 + 42) |