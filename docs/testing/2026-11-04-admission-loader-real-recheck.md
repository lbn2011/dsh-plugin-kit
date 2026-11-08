# admission-loader real Loader **recheck** — after the ASI fix

**Status: RUN ONCE — NOT ACCEPTED at the acceptance stage, node exit 15.** Three of
four required cases meet their expected status; `admission-activation-throw` is
`failed`. No document and no diagnostics were published. One launch, no retry.
Run directory
`experiments/acceptance/admission-loader-real/runs/20261103T213251Z-admission-loader-real-380195-28711/`.

This record began as a PREPARED-NOT-RUN skeleton; §6 and the envelope rows below are
transcribed from the run directory afterwards.

## 1. Why this recheck

The previous attempt
(`runs/20261103T211530Z-admission-loader-real-379361-1731/`) exited **14** at evaluate
with `EVIDENCE_OBSERVATION_INCOMPLETE: closeRejection: no rejection observation`. The
`closeRejection` fact was withheld because `containsInjectedFailure` was `null`, which
the fixture could only produce when the disposer retained no Error or the rejection
carried no `errors` array.

The documented diagnosis (`2026-11-04-admission-loader-real.md` §11) is a grammar
defect in the fixture's throwing branch — a semicolon-less statement followed by a line
beginning `(error)` is not split by ASI and parses as a call on a string, throwing
before `ref.error = error`. **That was a diagnosis from source text and evidence shape,
never an observed `TypeError`.**

Corrections then applied: the throwing branch uses `Object.assign(error, …)`;
`close-settled` carries `errorRefPresent`/`membersIsArray`/`memberCount`/`isAggregate`;
the containment limitation is emitted only for a comparison that returned `false`. A
unit attempt afterwards measured **87/87/0**
(`2026-11-04-admission-loader-asi-unit.md`).

## 2. What this run is, and is not

One transient systemd unit, one `node main.mjs --out <dir>` under bwrap, calling the
real `runAcceptanceLoop`: prepare → collect (real Loader boot, two rows, patch applied,
teardown) → evaluate → project → acceptance. The `source-review.json` gate compared the
two kit files against the recorded digests before any host work.

**Is not:** a unit test, a mock run, a build, or a certification of the kit. It measures
one bounded attempt against one pinned source state.

## 3. Scope

| Item | Value |
| --- | --- |
| Command | `bash experiments/acceptance/admission-loader-real/run.sh` |
| Scripts | unchanged; not edited for or after this run |
| Attempts | one. No retry, no in-run edit, no repair |
| Pinned checkout | `ce7073d51254c26cd63b22a60835b8f948deb447`, porcelain empty before launch |
| Caps / lock | shared acceptance lock; 768M, swap 0, Tasks 32, CPU 50%, Type=exec, 120 s, heap 384, single gate |

## 4. Pre-run state, read-only

| Item | Observed before launch |
| --- | --- |
| Prior run root | `…-379361-1731/` — retained, exit 14 preserved |
| Active `admission-loader-*` units | none (empty list, rc 0) |
| Checkout HEAD / porcelain | `ce7073d5…` / 0 lines |
| `MemAvailable` | 1846492 kB (gate 1228800) |

## 5. Run identity and envelope as measured

| Field | Measured |
| --- | --- |
| Run id | `20261103T213251Z-admission-loader-real-380195-28711` |
| Unit | `admission-loader-real-20261103T213251Z-380195` |
| `systemd-run.rc` | `15` |
| `status.txt` | `hash_status=identical`, `acceptance_exit=15`, `pinned_commit=ce7073d5…` |
| `real_exit_code` / `real_summary` | `15` / `not accepted: acceptance/NOT_ACCEPTED` |
| `source-review.json` | `pending:false`, `ok:true`, `code:null`; both kit digests equal the Lead-recorded values |
| `acc_capture_ok` | `yes` (every knob read back and matched) |
| cgroup knobs | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"`, `Type=exec`, `RuntimeMaxUSec` `2min`→`120000000` (`busctl` numeric `<unavailable>`) |
| Gate | `1818736 ≥ 1228800` KiB → `pass` |
| bwrap / heap | ro-root + `--bind <out> <out>` + private pid/net/ipc/uts + `--die-with-parent`; `--max-old-space-size=384` |
| `memory.peak` / current at exit / `pids.peak` | `177577984` / `62685184` / `15` |
| `memory.events.local` | all zero |
| Workload wall / node rc | `4649` ms / `15` |
| Journal | `status=15/n/a`, `Failed with result 'exit-code'`; `1.701s` CPU, `169.3M` peak |
| Unit after exit | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; active list empty |

## 6. Evidence transcribed

### 6.1 Canonical acceptance — 4 cases, 22 case-assertion pairs

From `raw-outcome.json` `acceptance`:

| Case | Expected | Observed | Assertions | All passed |
| --- | --- | --- | --- | --- |
| `admission-admitted` | passed | **passed** | 7 | yes |
| `admission-refused-conflict` | refused | **refused** | 5 | yes |
| `admission-activation-throw` | passed | **failed** | 5 | **no** |
| `admission-cleanup-failure` | passed | **passed** | 5 | yes |

22 of 22 case-assertion pairs are present. Recorded failures:

- `admission-activation-throw` / `assertion-failed`: "assertion
  rollback-disposer-ran-exactly-once is not true".
- `admission-activation-throw` / `status`: "expected status passed for this case,
  document says failed".

No document was published (`derived-document.json`: `present:false`, "a run that was
not accepted publishes no document"), and no diagnostics were published
(`diagnostics.json`: `present:false`). The failure is therefore visible only in the
acceptance stage and the observation, which is what the gates are for.

### 6.2 Coverage is complete; the false is computed, not missing

Every one of the four cases reports `missingAssertions: []` and `limitations: []`. So
the earlier incompleteness is gone: all 22 assertions were evaluated from observed
facts, and this failure is a comparison that returned **false**, not a withheld
observation.

### 6.3 The cleanup case now observes containment (the previous refusal's subject)

`close-settled` (seq 10) and the fact:

| Field | Value |
| --- | --- |
| `closeSettled` / `samePromise` | `rejected` / `true` |
| `rejectionCode` | `ERR_CLEANUP_SCOPE_FAILED` |
| `errorRefPresent` | `true` |
| `membersIsArray` | `true` |
| `memberCount` | `1` |
| `isAggregate` | `true` |
| `containsInjectedFailure` | `true` |
| `closeRejection` (fact) | `observed:true`, `{code:'ERR_CLEANUP_SCOPE_FAILED', isAggregate:true, containsInjectedFailure:true, sameOnRepeatedClose:true}` |
| `disposerRunCount` / `postCleanupReservation` | `1` / `conflicted` |

The discriminators resolve the ambiguity that made the last run undiagnosable: the
fixture retained its error, the rejection carried exactly one member, and that member is
the injected failure by identity. The case reports `passed`.

### 6.4 The failing case's facts

`admission-activation-throw`:

| Fact | Value |
| --- | --- |
| `activationEntryCount` | `1` |
| `activationThrew` | `true` |
| `errorIdentity` | observed |
| `rollback` | `{registered: 2, fulfilled: 2, rejected: 0, pending: 0}` |
| `rollbackDisposerRunCount` | **`2`** |
| `postThrowReservation` | `conflicted` |

### 6.5 Lifecycle and teardown

`booted:true`; coordinator row `stateName=active`, `settled:true`; scenario row
`settled:true`, `finalState=disposed`; `coordinatorServicePresent:true`;
`scenarioStatus:applied`; `coordinatorUnload {settled:true, stateName:'disposed'}`;
`fiber {settled:'fulfilled'}`; `cleanup {status:'drained', finished:[all four cases],
skipped:[], threw:[]}`; `teardown {settled:'fulfilled', reason:null}`. The Loader
lifecycle completed cleanly; the failure is in one assertion, not in teardown.

### 6.6 Hash pair and selected-set delta

`hashes-before.txt` and `hashes-after.txt` are 2780 B each (19 files), `cmp` identical,
no `hashes-diff.txt`. Against the exit-14 run, **exactly one line differs**:

`fixtures/scenarios.mjs` `81b3bb189937…b50b` → `24df6e320097…18e4`

`run.sh`, `payload.sh` and the other 17 hashed files are byte-identical. So the runner
is unchanged and one selected input changed — that is the whole claim. It is **not**
evidence that the changed file is the only thing that moved the outcome (see §8).

### 6.7 Raw paths, retained

| Artifact | Size |
| --- | --- |
| `argv.txt` | 2647 B |
| `hashes-before.txt` / `hashes-after.txt` (`.err` absent/empty) | 2780 B each |
| `unit.log` / `journal.txt` | 4523 B / 988 B |
| `status.txt` / `systemd-run.rc` | 224 B / 3 B |
| `hashes-before.err` / `hashes-after.err` | 0 B / 0 B |
| `out/source-review.json` | 778 B |
| `out/observation.json` | 23162 B |
| `out/derived-document.json` / `out/diagnostics.json` | 165 B / 171 B (both `present:false`) |
| `out/raw-outcome.json` | 2157 B |
| `hashes-diff.txt` | absent — no drift |

Both run roots under `runs/` are retained; nothing deleted or rewritten.

## 7. Attributed diagnosis of the one failure

**Evidence.** The fixture's throw case registers **two** rollback disposers —
`throw-rollback-first` and `throw-rollback-second`
(`fixtures/scenarios.mjs:693-694`) — defers both (`:702-703`), and derives
`rollbackDisposerRunCount` as `starts.length`, where `starts` is every
`cleanup-start` event in the case (`:726`, `:750`). Both ran, so the value is `2` and
`rollback.registered` is `2`. The evaluator's derivation for
`rollback-disposer-ran-exactly-once` is
`rollbackDisposerRunCount === 1` (`experiments/admission-loader-fixture/evaluate.mjs:351-354`),
so with two callbacks the assertion is `false` by construction.

**Why the two counters disagree.** The admitted and cleanup cases compute
`disposerRunCount` from **one disposer's own** invocation count —
`integerFact(disposer.invocations, …)` (`:521`) and
`integerFact(countedLedger.invocations, …)` (`:903`) — a per-disposer number, which is
`1`. The throw case instead counts events across the whole case, aggregating two
disposers. The same phrase, "ran exactly once", is therefore measured two different ways.

**Two readings, and I do not choose between them.**

1. The counter's semantics are wrong for a case that deliberately registers two
   callbacks: "exactly once" should mean *each registered rollback disposer ran exactly
   once* (both ledger rows `invocations === 1`, total `=== registered`), which the
   observed data would satisfy.
2. The fixture should register one rollback callback, and `2` is the fixture's own
   error against a canonical assertion id written in the singular.

The distinction matters and is not mine to settle: reading 1 changes what the assertion
means, reading 2 changes the scenario. Both are code-only changes to files I have been
told not to touch in this round.

**What is not in doubt.** The observation was complete, the rejection was not a
refusal, and the grade is a computed `false` on a fact whose value is unambiguously
recorded. This is not a repeat of the missing-observation problem.

## 8. What this record will not claim

1. Not a proof of correctness for the kit, the fixture or the protocol.
2. **No causal exclusivity.** Exactly one selected input changed; that shows the runner
   and the other listed inputs did not change, and nothing more. An unlisted transitive
   module, timing or machine state is outside the witness. In particular I do **not**
   claim the ASI fix caused the cleanup case to pass, only that the case now passes and
   that its discriminators read as they should.
3. Not a confirmation of the ASI diagnosis in the sense of an observed `TypeError`:
   that was never captured, and a passing case is consistent with the reading without
   being a record of it.
4. Not a rendered or forwarded quotation of `limitations[]` or `baseline.node`.
5. Not reproducible from HEAD alone: the experiment sources are untracked, so the hash
   pair is their identity, and hashes are evidence of bytes at two moments.
6. Not a certification: the loop's own limitation text says acceptance means the four
   cases reported their expected statuses, not that the kit is correct.

## 9. Gate

The authorised attempt is spent; the run stopped at NOT_ACCEPTED and nothing was
retried or repaired. The original exit-14 run stands as recorded and is not restated by
this one. A further attempt needs a new GO and its own record, and the one failure above
needs a decision (§7) before a further attempt could be expected to change.

## 10. Diagnosis of the single failure, appended after the run — NOT a measurement

Appended later, from source only. Nothing in §1–§9 is retracted or re-graded: the run
still reads 22/22 pairs present, three cases at their expected status, one `failed`, no
document, node exit 15.

### 10.1 What the failing assertion compares

`rollback-disposer-ran-exactly-once` is derived by
`evaluate.mjs:351-354` as `rollbackDisposerRunCount === 1`. The value came from the
fixture as `2`, and the observation itself was complete: `missingAssertions: []`,
`limitations: []`, `rollback = { registered: 2, fulfilled: 2, rejected: 0, pending: 0 }`.
So this is a computed `false` on a recorded value, not a gap.

### 10.2 The fixture counted the wrong thing, twice

The throw case registers two rollback callbacks (`fixtures/scenarios.mjs:693-694`,
deferred at `:702-703`), because
`registered-rollback-callbacks-settled` is plural and needs both to settle. It then
computed the singular "exactly once" count over **every** `cleanup-start` event
(`:726`, `:750`), i.e. over execution of both callbacks, which cannot be `1` in this
case. The plural and singular assertions were pointed at the same total.

The same expression was also used for `registered` (`:741`). That is a second defect
with a worse shape: `cleanup-start` fires only when a callback *runs*, so
`registered` was a count of invocations. A callback that was registered and never
invoked would reduce `registered` as well as `fulfilled`, the ledger would still add up,
and `registered-rollback-callbacks-settled` would pass over an omitted callback. The
admitted and cleanup cases already avoided this by reading one disposer's own
`invocations` counter (`:521`, `:903`); the throw case did not.

### 10.3 Correction applied to the fixture — written, not run

- Registrations are now recorded at the call site, once per `context.defer` that
  returned, as independent `defer-registered` events with their label and running
  ordinal. A partial registration path is therefore countable.
- `registered` is `registeredCount`, the number of those events. Execution is counted
  separately from settlement events. `outstanding = registered − settled − threw` is
  reported as `pending`, so a registered-but-never-invoked callback is outstanding
  rather than absent, and the evaluator's
  `fulfilled + rejected + pending === registered` invariant (enforced at
  `evaluate.mjs:205-211`) still holds while the plural assertion fails as it should.
- `rollbackDisposerRunCount` is now the **designated** callback's own invocation
  counter: `ledger[0]`, i.e. the disposer deferred first, with sources restricted to
  its own `cleanup-start` events. The designation is documented in the fixture because
  §6.2's wording is singular while this case needs two registrations. The evaluator's
  `=== 1` is unchanged, as is the id.
- New limitations are emitted when the ledger is left outstanding, when settlement
  events outnumber registrations, and when a disposer reports itself mid-invocation
  while the settlement events report nothing outstanding.

### 10.4 What the correction does not establish

A green re-run would show that the case converges under the corrected accounting. It
would not show that the earlier `2` came from this mechanism alone, that the spec's
singular/plural wording is settled policy, or that the case is correct in any sense
beyond "reported its expected status through observations that were read". No such
re-run has been made, and none is authorised here.
