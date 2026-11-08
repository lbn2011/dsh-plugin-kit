# Resource admission — development plan

> Date: 2026-11-02 · Status: **bounded implementation verified: 152/152 suite tests passed.** The single run `20261102T125552Z-admission` includes 34 admission cases, seven real-kit/mock-host compositions and 111 existing kit cases. See the [execution record](../testing/2026-11-02-resource-admission.md). This accepts the caller-shared helper within that scope, not real Loader admission, cross-process coordination or universal compatibility.

> **[Decided, 2026-11-02]**
> - **Surface:** `import { createAdmissionCoordinator } from 'dsh-plugin-kit/admission'` (exports map `package.json` `./admission`): one factory, `CLAIM_KINDS`, four error classes. Nothing else is public.
> - **Instance:** `reserve(claims)`, `admit(claims, activate)`, `size` — caller-owned, no module-level table, no default instance, no `ctx` import. `reserve()` is synchronous, all-or-none, and returns **ONE frozen lease**: `claims`, `state`, `release()`, `quarantine()`.
> - **The winner is the first successful synchronous `reserve`; its lease identity is an internal token** (the owning record). A later overlapping batch is refused whole — not order-independent, not "refuse both". No numeric generation is exposed or honoured; release checks record identity, never the key.
> - **`admit()` gives the callback a frozen `{ defer }` and resolves `{ value, close }`.** The callback's return value is its own value — never an implicit disposer.
> - **A throwing activation always quarantines**, even when its rollback was clean. An arbitrary `error.rollback` property is **not** awaited by this module.
> - **`close()`:** clean settlement releases; any cleanup failure quarantines and rejects. **Quarantine is terminal** — no clear, reset, expiry or force-release API.
> - **No bypass advice:** a second coordinator does not coordinate with the first and cannot prove stale effects are gone (§3.6).

> **[Verified in bounded tests]** Exact own-data-property tuple validation; already-trimmed string enforcement; released-lease quarantine rejection; reentrant shared-close-promise behavior. Raw runner output records all 152 cases passing, with exit status 0 and unchanged selected source hashes.

## 1. Objective

One bounded, caller-owned admission helper answering one question before a plugin acts: *do I already hold these `(kind, name, scope)` claims?* It reserves a batch atomically, hands back a lease, and never declares claims free unless every cleanup it was handed succeeded.

## 2. Current state (evidence)

| Block | Where | Relevance |
|---|---|---|
| Factory and lease transitions | `src/admission.js:537` `createAdmissionCoordinator`, `src/admission.js:608` `releaseRecord`, `src/admission.js:630` `quarantineRecord` | lease identity and terminality |
| Validation before mutation | `src/admission.js:411` `auditClaims`, `:437-444` exact own-key set, `:446-491` own data fields and already-trimmed values; `:503-519` duplicate detection | §3.2 |
| Reserve / conflict / insert | `src/admission.js:554` `reserveInternal` | first-reserve-wins (§3.3) |
| `admit()` / `close()`, scope reused | `src/admission.js:656` `admit`, `src/admission.js:726` settlement allocated before `src/admission.js:731` scope close | §3.4; `{ defer }` and one settlement promise; arbitrary `.rollback` is the caller's to await |

The contract requires rejection **before** the activation callback runs, so a losing activation never executes its registration side effects. Static review confirms the source implementation matches the revised claim and lease-state contract. The executed unit and mock-port integration cases now verify this bounded behavior; no actual Loader admission test is claimed.

## 3. Contract

### 3.1 Surface

```js
import { createAdmissionCoordinator } from 'dsh-plugin-kit/admission';
import { registerManagedResource } from 'dsh-plugin-kit/managed-registration';
const coordinator = createAdmissionCoordinator(); // shared by all cooperating participants in this domain
const handle = await coordinator.admit([{ kind: 'tool', name: 'demo-tool', scope: 'plugin' }], (ctx) => {
  const managed = registerManagedResource(ports);
  ctx.defer(() => managed.close());                                     // explicit, never implicit
  return managed;                                                       // becomes handle.value
});
await handle.close();                                                   // releases only if clean
```

### 3.2 Claims and validation

`{ kind, name, scope }` is the whole identity. `kind` is exactly `'tool'` or `'service'` — no case folding, no aliases, no other vocabulary; `name`/`scope` are strings.

| # | Rule | Code |
|---|---|---|
| 1 | Non-empty array of objects; `kind` exactly `tool` \| `service` | `ERR_ADMISSION_CLAIMS` |
| 2 | `name`/`scope` non-empty, already trimmed (outer whitespace rejected), exactly three own data properties | `ERR_ADMISSION_CLAIMS` |
| 3 | No repeated tuple inside one batch | `ERR_ADMISSION_CLAIMS` |
| 4 | No claim already held or quarantined here | `ERR_ADMISSION_CONFLICT` (+`.conflicts`) |

Every check completes before the first mutation, so a rejected batch costs nothing. Exported errors: `AdmissionClaimsError`, `AdmissionConflictError` (`ERR_ADMISSION_CONFLICT`), `AdmissionLeaseStateError` (`ERR_ADMISSION_LEASE_STATE`), `AdmissionActivationRollbackError` (`ERR_ADMISSION_ROLLBACK`, an `AggregateError`). A `close()` rejection is the scope's own `ERR_CLEANUP_SCOPE_FAILED`, unwrapped.

### 3.3 `reserve()` and the lease

Validate, check overlap, insert — no await, so no caller code interleaves between the conflict check and the commit. The first caller to reach the insert wins; every later overlapping batch throws with `.conflicts` in batch order and takes nothing.

| Member | Meaning |
|---|---|
| `claims` | frozen tuples; key is memoised `JSON.stringify([kind, name, scope])` |
| `state` | `'reserved'` \| `'released'` \| `'quarantined'` |
| `release()` / `quarantine()` | release is idempotent; quarantine is idempotent while reserved, terminal, and keeps claims held. Quarantine on a released lease throws `ERR_ADMISSION_LEASE_STATE` without changing state or touching a newer owner |

Ownership is checked as *this record owns this key*, so a stale lease can never free a newer claim on the same tuple: it finds the key owned elsewhere and does nothing. The token stays internal — no generation number is exposed, and none is accepted.

### 3.4 `admit()` and `close()`

```
admit(claims, activate)
  ├─ typeof activate !== 'function' → TypeError, before anything is reserved
  ├─ reserve(claims)                    // shape/conflict errors throw; callback never runs
  ├─ value = await activate(frozen { defer })
  │    └─ throw → quarantine THIS lease // always, rollback clean or not
  │              await scope.close()    // the module's own rollback, awaited
  │              clean → rethrow the activation value; failed → AdmissionActivationRollbackError
  └─ resolve frozen { value, close() }
close() → first call stores the promise BEFORE any cleanup runs; clean → release();
          failed → quarantine() and reject with the scope's aggregate (same value, not re-wrapped)
```

The callback must `defer()` every cleanup at acquisition time; the module closes only what it was handed. Its return value is **not** a disposer — a caller returning a managed handle defers `() => managed.close()` explicitly. `close()` memoises one promise object before starting cleanup; every later call, including a reentrant call from cleanup and calls after settlement/rejection, returns that same object. A regression asserts identity without awaiting the promise from inside its own cleanup.

### 3.5 Quarantine

Quarantined claims stay held, so the next `reserve` of those tuples throws `ERR_ADMISSION_CONFLICT` — accurate, since teardown did not prove removal. No public API clears, resets or expires them. `quarantine()` on an already-`released` lease throws `ERR_ADMISSION_LEASE_STATE` and leaves both its state and the coordinator table unchanged; this prevents a stale lease from poisoning a newer owner's claim.

### 3.6 What this does not prove — and no bypass

Releasing is bookkeeping: it observes no host, confirms no unregister took effect, cannot undo external writes. `release()` after a clean `close()` means *"every cleanup I was handed succeeded"*, not *"the resource is gone"*. Two coordinators never coordinate either: a second instance — or a restart — cannot see the first's claims and **cannot prove stale effects are gone**; it only stops tracking them. So this module offers no "move to a fresh coordinator" recovery advice: that trades a known-unknown state for a silent one. There is no in-place reset API; discarding a coordinator or process is not proof that external effects were removed.

## 4. Out of scope and risks

| Not provided / risk | Position |
|---|---|
| Deadlines, lease expiry, heartbeat; atomic host publish; cross-process arbitration; sandboxing; `forceClear` | Inherited from `src/cleanup.js:91-104` — a timeout cannot prove a callback stopped; in-process author tooling only; a wedged tuple is terminal by design and never silently cleared |
| `release()` misread as "resource removed" | §3.6; `release()` performs no host call |
| A test or caller uses a second coordinator as a bypass | Share one coordinator within the cooperating domain; a new instance cannot prove old effects are gone |
| Two coordinators used by accident | Explicitly share one coordinator within each cooperating domain; separate instances do not coordinate; `size` is per instance |

## 5. Task breakdown

- [x] **T1** Enforce exact own data-property claims and reject non-trimmed strings in `auditClaims`; update `admission.d.ts` and negative cases.
- [x] **T2** Reject quarantine after release without mutating lease/table; preserve one reentrant memoized close promise.
- [x] **T3** Execute the complete ten-file kit suite once under 768M/swap0/pids32/CPU50% with requested exec120/heap384 and an in-unit gate of 1200 MiB: 152/152 passed; source hashes preserved.
- [x] **T4** Review raw results and accept the bounded helper behavior. No publish or version bump (`package.json:3-4` remains private `0.0.0`).
