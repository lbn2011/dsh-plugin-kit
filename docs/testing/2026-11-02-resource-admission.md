# Resource admission — test skeleton

## Current verdict

**ONE ATTEMPT AUTHORISED, LAUNCHED ONCE AND FINISHED — started 2026-11-02 20:55:52 (Asia/Shanghai),
ended 20:55:58, `systemd-run` exit status 0, not rerun. Its result, the observed envelope, the gate
sample and every numbers-bearing claim are in [§7 "Executed record"](#7-executed-record) at the foot
of this file, written from that attempt's own retained raw artifacts under
[`runs/20261102T125552Z-admission/`](runs/20261102T125552Z-admission/).**
Sections 1–6 below are the pre-execution skeleton, preserved unedited and now **superseded by §7**:
their "NOT RUN" wording was true when written and is still true of the history of this file, but the
attempt described in §7 stands on its own raw record.

**Status when the body below was written: NOT RUN. Nothing in the body had been executed.** No
command in it was run, no process was started, no log existed, and no case was claimed to pass.
It is a skeleton: the commands are written out so a later authorized attempt runs exactly this,
and the evidence table says what that attempt must leave behind.

> Date: 2026-11-02 · Companion to the [development plan](../requirements-and-design/2026-11-02-resource-admission-dev-plan.md).
> Under test: `projects/dsh-plugin-kit/src/admission.js` and `tests/admission.test.js` — **unaudited drafts**, not accepted code.

## 1. Scope

| In scope | Out of scope |
|---|---|
| The coordinator's own in-memory bookkeeping: `reserve`, `admit`, `size`, leases, quarantine | Any host `ctx` behaviour; the module imports none (`src/admission.js:185` imports only `./cleanup.js`) |
| Error identity: `ERR_ADMISSION_CLAIMS`, `ERR_ADMISSION_CONFLICT`, `ERR_ADMISSION_LEASE_STATE`, `ERR_ADMISSION_ROLLBACK`, `ERR_CLEANUP_SCOPE_FAILED` | Atomic publish, cross-process arbitration, timeouts — not provided by design |
| That a loser never runs its activation callback | Whether a *host* registration would have succeeded |

There is no host simulation anywhere: the coordinator owns no host state, so "is this claim
held" is observed only through a later `reserve` conflicting or not.

## 2. Planned envelope

| Knob | Planned value | How it would be observed |
|---|---|---|
| `Type` | `exec` | `systemctl show` on the unit |
| `MemoryMax` | `768M` | `memory.max` = `805306368` |
| `MemorySwapMax` | `0` | `memory.swap.max` = `0` |
| `TasksMax` | `32` | `pids.max` = `32` |
| `CPUQuota` | `50%` | `cpu.max` = `50000 100000` |
| `RuntimeMaxSec` | `120` | `RuntimeMaxUSec` = `120000000` |
| Node heap | `--max-old-space-size=384` | the flag as passed, plus a V8 heap self-report (a different quantity) |
| Availability gate | `MemAvailable >= 1200 MiB` | **one** sample before launch; no polling |
| Attempts | **one** | a second attempt is a new record, not a retry inside this one |

The gate is a host-capacity precondition, not a test result: a refused gate means nothing ran.

## 3. Commands (skeleton — NOT RUN)

```
# 0. gate, read once, host side
awk '/MemAvailable/ {print $2}' /proc/meminfo        # must be >= 1228800 kB (1200 MiB)

# 1. unit, one attempt
systemd-run --quiet --wait --pipe --collect \
  --unit admission-<UTCSTAMP> \
  --property=Type=exec \
  --property=MemoryMax=768M \
  --property=MemorySwapMax=0 \
  --property=TasksMax=32 \
  --property=CPUQuota=50% \
  --property=RuntimeMaxSec=120 \
  --setenv=NODE_OPTIONS=--max-old-space-size=384 \
  --working-directory=/root/dsh-ecosystem-spec/projects/dsh-plugin-kit \
  -- /www/server/nodejs/v24.21.0/bin/node --test --test-concurrency=1 tests/admission.test.js
```

Record the unit name, the `systemd-run` exit status, and the raw stdout/stderr. If the unit
never starts, that is the result — write it down and stop; do not re-run inside the same record.

## 4. Case skeleton

Every case maps to a clause in the plan; **none has been executed**. `[P1]`/`[P2]` cases cannot
be written until those decisions land.

| # | Would assert | Plan ref |
|---|---|---|
| C1 | Module exports exactly `createAdmissionCoordinator`, `CLAIM_KINDS`, the four errors; `CLAIM_KINDS` frozen `['tool','service']` | §3.1 |
| C2 | `reserve()` returns one frozen lease; `state` `'reserved'`; `claims` frozen tuples; `size` counts them | §3.3 |
| C3 | The first synchronous `reserve` wins; a later overlapping batch throws `ERR_ADMISSION_CONFLICT` with `.conflicts` and takes nothing | §3.3 |
| C4 | Malformed batch → `ERR_ADMISSION_CLAIMS`, coordinator unchanged | §3.2 |
| C5 | Repeated tuple inside one batch → `ERR_ADMISSION_CLAIMS` (same trimmed tuple) | §3.2 |
| C6 | **[P1]** extra own key rejected; `' demo'` rejected as untrimmed | §3.2 |
| C7 | `release()` idempotent, frees the claims; a stale lease cannot free a newer claim on the same tuple | §3.3 |
| C8 | `quarantine()` terminal: a later `reserve` conflicts, `size` still counts the claims | §3.5 |
| C9 | **[P2]** `quarantine()` on an already-released lease — `ERR_ADMISSION_LEASE_STATE` or no-op | §3.5 |
| C10 | `activate` receives a frozen object exposing only `defer`; handle is `{ value, close }`; `value` is the callback's settled return | §3.4 |
| C11 | A returned object's `close` is **not** invoked automatically — only a deferred disposer runs | §3.4 |
| C12 | Throwing activation → quarantine **always**; clean rollback rethrows the same value; failed rollback → `ERR_ADMISSION_ROLLBACK` with `errors[0]` the primary | §3.4 |
| C13 | An `error.rollback` property on the thrown value is never awaited by the module | §3.4 |
| C14 | `close()` clean → released; failing cleanup → quarantined and rejects with `ERR_CLEANUP_SCOPE_FAILED`, unwrapped; repeated calls return the same promise object | §3.4 |
| C15 | A losing `admit` never runs its callback (counter stays 0) | §3.3 |
| C16 | Two coordinators are independent; no module-level state | §3.6 |

## 5. Mandatory evidence

The record must contain **original** artifacts. Summaries may accompany them but never replace
them, and trimming, re-ordering or re-typing output invalidates it.

| File | Content | Rule |
|---|---|---|
| `logs/stdout.log`, `logs/stderr.log` | verbatim, as written | no edits, no interleaving |
| `records/run.json` | unit name, exit status, timestamps, gate sample | observed values only |
| `records/envelope.txt` | `Type`, `MemoryMax`, `MemorySwapMax`, `TasksMax`, `CPUQuota`, `RuntimeMaxSec` as the manager reports them | verbatim `systemctl show` lines |
| `records/host.txt` | the single `MemAvailable` sample with its timestamp | one line, one sample |
| `hashes.sha256` | `sha256sum` of **every** file in the record, plus `src/admission.js`, `src/admission.d.ts`, `tests/admission.test.js` as they stood at run time | full paths + digest |
| anything absent | written as `absent` | never fabricated, never inferred |

A case is "passed" only if C1–C16 (minus the blocked `[P1]`/`[P2]` ones) are covered by that
record's own output and the record's hashes verify. Until then every clause in the plan stays
a draft claim.

## 6. Non-claims

- No result, duration, memory figure, coverage number or pass count is stated here.
- `tests/admission.test.js` existing is **not** evidence that it passes, is correct, or matches
  the contract — it is an unaudited draft like the module.
- This skeleton does not authorize anything; an attempt needs its own explicit go-ahead.

## 6.5 Pre-execution static review of reentrant-teardown deadlock risk (written BEFORE the attempt)

Required before the run: the suite is said to expect reentrant teardown, which is exactly the
shape that hangs instead of failing. Read-only scrutiny, no execution.

| Question | Finding | Where |
|---|---|---|
| Does a cleanup await its own `close()`? | No. The one reentrant case *compares* the promise identity and returns; its own comment says "awaiting it from inside itself would be the documented deadlock, and this test would hang rather than fail, so it deliberately does not". | `tests/admission.test.js:564-590` |
| Does `close()` publish its promise before the first cleanup runs? | Yes: the settlement promise is constructed, then `scope.close()` is called and `.then`-ed onto it. A reentrant `close()` therefore returns the same object rather than chaining a second teardown. | `src/admission.js:716-746` |
| Any `child_process`, timers, signals or polling in the suite? | None in either file. No `spawn`/`exec`/`fork`, no `setTimeout`/`setInterval`, no signal handlers, no `process.exit`. | `tests/admission.test.js`, `tests/admission-integration.test.js` |
| Any await whose gate is opened only afterwards? | None found. Each gated await (`entered.promise`, `hold.promise`, `releaseGate`) is opened on the synchronous path before the await that depends on it, so no test can wait on a promise nobody resolves. | `tests/admission-integration.test.js:166-208`, `:295-326` |
| Residual risk | A silent regression in `close()` would present as a **hang**, not an assertion failure. It is bounded, not detected, by `RuntimeMaxSec=120`, and a timeout kill is recorded as a non-pass rather than a pass. | §2, §7 |

Conclusion recorded before the attempt: no self-await deadlock is reachable through the suite as
written; the suite's only hang surface is a broken subject under test, and the envelope bounds it.

## 7. Executed record

**One attempt, one launch, no rerun.** Started `2026-11-02T20:55:52+08:00`, ended `20:55:58+08:00`,
`systemd-run` exit status `0` ([30-launch-exit-status.txt](runs/20261102T125552Z-admission/30-launch-exit-status.txt));
unit `admission-1793624152.service`, after `--collect` `Result=success`/`ExecMainStatus=0`/
`LoadState=not-found`, journal "Consumed 2.810s CPU time, 74.2M memory peak"
([60-post-attempt.txt](runs/20261102T125552Z-admission/60-post-attempt.txt)). Raw evidence:
[12-invocation.txt](runs/20261102T125552Z-admission/12-invocation.txt),
[20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log) (259 lines),
[21-unit-stderr.log](runs/20261102T125552Z-admission/21-unit-stderr.log) (0 bytes),
[11-hashes-before.txt](runs/20261102T125552Z-admission/11-hashes-before.txt),
[50-hashes-after.txt](runs/20261102T125552Z-admission/50-hashes-after.txt).

### 7.1 What actually ran

- Exactly **one** `systemd-run` invocation — `--service-type=exec`, the six properties, payload
  `bwrap --ro-bind / /` + `env -i` + one bash runner
  ([12-invocation.txt](runs/20261102T125552Z-admission/12-invocation.txt):1-42,
  [20-envelope-runner.sh](runs/20261102T125552Z-admission/20-envelope-runner.sh):97-98).
- **One runner invocation, not one process**: the runner starts a single `node` test process
  ([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):59-68) which fans out to
  10 files under `--test-concurrency=1` and whose CLI/scaffold cases spawn children — so the unit's
  `pids.peak=32` counts descendants, not one process.
- Tests saw `env -i`: only `PATH`/`HOME` plus bash's own `PWD`/`SHLVL`/`_`
  ([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):38-45), so
  `DSH_COMPAT_SPEC` was absent by construction.

### 7.2 Result as the runner reported it

`tests 152 · pass 152 · fail 0 · cancelled 0 · skipped 0 · todo 0 · duration_ms 5313.565725`,
`TESTS_EXIT=0` ([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):221-230).
Ten files ([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):48-58):
34 admission, 7 integration, 111 pre-existing — 152 in total.

### 7.3 Envelope: requested versus observed

| Knob | Requested (argv) | Observed inside the unit |
|---|---|---|
| `MemoryMax` | `768M` | `memory.max=805306368` — matches |
| `MemorySwapMax` | `0` | `memory.swap.max=0` — matches |
| `TasksMax` | `32` | `pids.max=32` — matches |
| `CPUQuota` | `50%` | `cpu.max=50000 100000` — matches |
| `Type` | `exec` | **not observed** — no `systemctl show` ran inside the unit |
| `RuntimeMaxSec` | `120` | **not observed** — no timeout fired, nothing read it back |
| Node heap | `--max-old-space-size=384` | argv only; **no V8 heap self-report appears in the raw output** |

The four `limit.*` values come from the cgroup directory inside the unit
([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):7-16) — effective values, not
argv restated. `Type`/`RuntimeMaxSec` were requested ([12-invocation.txt](runs/20261102T125552Z-admission/12-invocation.txt):12,17)
but never read back inside the unit, so the post-attempt `systemctl show` `Type=`/`RuntimeMaxUSec=infinity`
reflect only the collected unit's absence ([60-post-attempt.txt](runs/20261102T125552Z-admission/60-post-attempt.txt):5-14).
Heap `384` is `argv.1` only: **no heap statistic is claimed**, in either direction.

### 7.4 Gate — one sample, no polling

`gate.sample.kb=1621336` = `1583.3 MiB` against `threshold.kb=1228800` (1200 MiB) → `GATE=PASS`,
sampled once at `20:55:52` before any test ([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):27-37).

### 7.5 Resource peaks (read inside the unit, before `--collect`)

`memory.peak=77836288` (≈74.2 MiB), `memory.swap.peak=0`, `pids.peak=32`, `cpu.stat` `nr_throttled=55`/
`nr_periods=57` (`throttled_usec=3477572`), `memory.events` `max`/`oom`/`oom_kill` all `0`,
`memory.pressure` full `avg300=0.00` — matching the journal's "2.810s CPU, 74.2M peak"
([20-unit-stdout.log](runs/20261102T125552Z-admission/20-unit-stdout.log):231-256). `pids.peak=32` only
**equals** `pids.max=32`, and with no `pids.events` read it is **not proof** the cap denied anything.

### 7.6 Source hashes, before versus after

24 entries, once per file
([11-hashes-before.txt](runs/20261102T125552Z-admission/11-hashes-before.txt):7-30): `package.json`,
8 `src/*.js` (`admission`, `cleanup`, `cli`, `index`, `managed-registration`, `manifest`, `protocol`,
`scaffold`), 4 `src/*.d.ts`, `src/internal/value.js`, 10 test files. All 24 digests identical
afterwards ([50-hashes-after.txt](runs/20261102T125552Z-admission/50-hashes-after.txt):4-27) — no
source was written. Selected full SHA-256:
`src/admission.js` `d2f2a266b7b86537b7712df49b7b030e59e470253522001801f82fc53948f1c4`;
`tests/admission.test.js` `51f083db8a19f5589fe291a652eb44456bb6db07932d25eaeb509f6e153adabe`;
`tests/admission-integration.test.js` `3cedf14d01a59ba7384e729bb62340acc2fa5c18e1f767db03036e7702f737e9`;
`src/cleanup.js` `5fab080e82c7f30523d28bdc8b3904be25ab5bf14a9580c2562f8fe7909f5d10` — all unchanged after.

### 7.7 What this record does not establish

- **Real kit, mock ports**: the integration cases drive `src/managed-registration.js` through
  caller-supplied ports; no real DSH Loader or host process took part. No host-integration claim.
- **No cross-repo validation**: `env -i` left `DSH_COMPAT_SPEC` unset. The opt-in test returns early after asserting that absence (`tests/protocol.test.js:208-214`); it does not load the real protocol validator in this run.
- **Earlier source-author disclosure**: an earlier code-writing worker disclosed a `node -e "1"` no-op contrary to its code-only instruction. This was not the bounded test executor's disclosure and is not evidence of another suite run. The no-op appears in neither this run's argv nor its test file list.
- **No misplaced report**: no such file is evidenced in the retained artifacts; nothing rests on one.
- **No rerun; superseded decisions**: the historical `[P1]`/`[P2]` items in §4 were resolved before this run. Exact-field validation and rejection of quarantine after release are implemented and covered by passing cases in the raw runner output. Sections 1–6 remain a historical skeleton, not current open blockers.
