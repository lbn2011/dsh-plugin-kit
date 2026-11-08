# Admission under a real Loader — test skeleton

**Status: EXECUTED ONCE — 2026-11-02T15:03Z.** Unit `admission-loader-20261102T150305Z`
exited 0 and the run validator accepted that launch: 57 of 57 assertions true,
`run.json` `status=passed`. The executed record is appended as **§9**, copied from that
attempt's retained raw artifacts under `runs/20261102T150305Z-admission-loader/`.

**Historical skeleton status, preserved verbatim:** *"Status when this body was written:
NOT RUN. Nothing in it was executed. No command in it was run, no unit was started, no log
or record exists, and no case is claimed to pass. The commands are written out so a later
authorised attempt runs exactly this, and the evidence table in §6 says what that attempt
must leave behind."* §1–§8 below remain the pre-execution plan. Read them as plan, never as
a post-hoc description of what happened: where they differ from §9, §9 is what was measured
and §6's group counts in particular proved to be an undercount (§9.4).

> Date: 2026-11-02 · Host-level companion to
> [`2026-11-02-resource-admission.md`](2026-11-02-resource-admission.md).
> Under test: `projects/dsh-plugin-kit/src/admission.js`, accepted within the prior 152-test unit/mock-port scope. The new Loader fixture is an unexecuted draft under correction; that prior acceptance is not Loader evidence.

## 1. What this document adds

`2026-11-02-resource-admission.md` covers the coordinator as a MODULE: every case
drives `reserve`/`admit` directly, and §7.7 says plainly that no real DSH Loader or
host process took part. That leaves the question this document is about:

> When two contenders are real Loader rows in one real composition, sharing one
> coordinator, does admission still admit, refuse and quarantine — and is the
> cleanup it hands back actually collected and run by Cordis?

| In scope | Out of scope |
|---|---|
| `admit`/`reserve` driven from real `apply()` bodies behind real rows | Claims of kind `service` (same code path, not separately exercised) |
| Refusal reaching a competitor before its activation callback runs | Cross-process or cross-version arbitration |
| The `{ value, close }` handle's async disposer being collected by Cordis | `dsh` CLI, GUI, browser, full application boot |
| A failing cleanup: Loader settles, close promise rejects, claim stays held | Lease expiry, heartbeats, timeouts — none exist by design |
| A stale `close()` returning the same promise with no effect on a newer owner | Atomic publish of claims at the host layer |

## 2. Harness

Slice: `experiments/dsh-live-lab/admission/` (see its `README.md`). It reuses
`experiments/dsh-live-lab/managed-cleanup/lib/host.mjs` unchanged — `bootFixtureHost`,
`resolveEntry`, `disposeHost`, `waitForState`, `lookupTool`, `dispatchTool` — and
the pinned built checkout under `experiments/dsh-live-lab/build-checkout/`.

There is no fake Loader and no monkeypatching. Five thin role modules are copied
into the runtime root and mounted as five rows, all disabled at boot; the arm moves
them with `ctx.loader.update()`, reads `entry.fiber.state`, asks `ctx.tools.get()`
whether a probe is registered, and asks the coordinator itself whether a claim is
free (a conflict is the evidence that it is not).

One coordinator instance: the copies import `./admission-coordinator.mjs`, the arm
imports the same path by absolute URL, so the module cache hands both sides one
namespace. Compare the actual coordinator object and resolved module URL; the fixed token is only a diagnostic label, not identity or authenticity proof.

## 3. Cases

| Case | Sequence | Expected |
|---|---|---|
| **A** admitted, activation paused | enable `admission-alpha` | apply entered; callback entered; fiber LOADING while paused; 0 registers; claim held; after the gate opens: observed ACTIVE, 1 callback, 1 register, probe dispatches |
| **B** competing enable | enable `admission-beta` while A paused | `ERR_ADMISSION_CONFLICT`; **0** activation callbacks; **0** registers |
| **A settle → B retry** | open gate, disable A, disable+enable B | A: cleanup invoked, close fulfilled, exact native disposer ran once, claim released; B: fresh apply, admitted, probe dispatches |
| **A stale close** | `close()` on A's old handle after B admitted | same promise object; B's claim still held; B's registration identity unchanged |
| **C** cleanup throws | enable `admission-fault`, disable it, enable `admission-gamma` | Loader unload RESOLVES; close promise REJECTS with `ERR_CLEANUP_SCOPE_FAILED`; register disposer ran once; claim still held; gamma refused, 0 callbacks |
| **D** activation throws (optional) | enable `admission-throw` | registered, then threw; claim quarantined; rollback ran the exact register disposer once; the SAME error object rethrown, aggregate size 0 |

Two properties are preconditions of reading any of it:

- **`apply` is an arrow**, not a `function` declaration. A constructible callback is
  invoked with `new` and only `instance[symbols.init]?.()` is returned
  (`build-checkout/vendor/cordis/src/fiber.ts:257-266`), so the cleanup would be
  discarded and no `close()` would ever run. `prepare.mjs` refuses a copied role
  module whose `apply` is a function declaration.
- **Admission is awaited inside the non-constructible async entry**, and failures are recorded then rethrown to Loader. Loader update is not an activation-completion barrier (`vendor/loader/src/config/entry.ts:213-237`); the arm independently observes LOADING while gated and ACTIVE after settlement. Floating admission to report premature ACTIVE is not accepted.

## 4. Planned envelope

| Knob | Planned value | How it is observed |
|---|---|---|
| `Type` | `exec` | `systemctl show --property=Type --value` |
| `MemoryMax` | `768M` | `memory.max` = `805306368` |
| `MemorySwapMax` | `0` | `memory.swap.max` = `0` |
| `TasksMax` | `32` | `pids.max` ≤ `32` |
| CPU | 50% | `cpu.max` quota ≤ half the period |
| `RuntimeMaxSec` | `120` | `RuntimeMaxUSec` ≤ 120 s |
| Node old space | `384` MiB requested | exact `NODE_OPTIONS=--max-old-space-size=384`; a separate V8 total-heap probe is not an old-space measurement |
| Host capacity gate | `MemAvailable` ≥ `1200` MiB | one non-polled read of `/proc/meminfo` before launch |
| Filesystem | host read-only, `root` the only writable bind | `bwrap --ro-bind / /` first, `--bind "$ROOT" "$ROOT"` last |
| Isolation | private PID/IPC/UTS/net/cgroup namespaces, `--tmpfs /tmp`, `--clearenv` | `bwrap` argv |

No launch is retried and the capacity gate is sampled once, without polling for more memory. The reused `waitForState` helper does poll Loader state with a bounded observation timeout; that timeout does not cancel activation or prove cleanup. A refused preflight must stop before preparation or host boot; the bounded launcher/probe process itself may already have started.

## 5. Planned command

```bash
cd experiments/dsh-live-lab/admission
systemd-run --quiet --wait --pipe --collect --unit "admission-$(date +%s)" \
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=CPUQuota=50% --property=RuntimeMaxSec=120 \
  --setenv=DSH_ADMISSION_ROOT="$PWD/work/run-$(date -u +%Y%m%dT%H%M%SZ)" \
  --setenv=DSH_ADMISSION_ALLOW_ROOT="$PWD" \
  --setenv=NODE_BIN="$(command -v node)" \
  -- bash "$PWD/run-isolated.sh"
```

Inside the sandbox `payload.sh` runs four steps once each: V8 heap probe →
`prepare.mjs` → `arm.mjs` → `validate-records.mjs`. Step statuses are exported
(`DSH_ADMISSION_HEAP_PROBE_RC`, `…_PREPARE_RC`, `…_ARM_RC`, `…_VALIDATE_RC`).

## 6. Evidence an attempt must leave behind

| Artifact | Required shape |
|---|---|
| `…/logs/payload.log` | one line per step with its rc; no kill, no self-imposed timeout |
| `…/prepare.json` | `schemaVersion`, `rows`, `plugin.moduleUrls`, `coordinatorUrl`, `traceUrl`, `recordPaths`, `sourceSignatures` |
| `…/records/arm.json` | `type: admission/arm`, `status`, and the complete reviewed assertion set from `lib/expectations.mjs` (final count recorded before execution) |
| `…/records/run.json` | `type: admission/run`, `status: passed`, `arms[0].status: passed`, every expected assertion id in `coveredAssertions` |

The arm's assertion list is fixed: a run that omits one is invalid, because a
missing assertion is indistinguishable from one that silently never ran.
`validate-records.mjs` must require BOTH the persisted record's complete successful assertions and exact zero step exits. Parsing errors, nonzero exits, missing or skipped assertions and inconsistent status must all fail the aggregate; neither JSON nor an exit code is sufficient alone.

Groups: `inputs-*` (2), `prepare-*` (1), `shared-coordinator-*` (3), `source-unmodified-*`
(2), `a-*` (19), `b-*` (9), `c-*` (9), `d-*` (5), `host-teardown-settled`,
`expected-assertions-all-present`.

## 7. Executed record

**Superseded: see §9.** This placeholder was empty when the skeleton was written and is
deliberately left unfilled rather than overwritten, so the boundary between plan and result
stays visible on the page. Its instruction still governs §9: every number there is copied
from the retained raw artifacts, never from expectation or from the similarly-named records
of another slice.

## 8. What a green run would not establish

- No cross-version or cross-repo validation; `DSH_COMPAT_SPEC` is not exercised.
- No browser, GUI, `dsh` CLI session, or full application boot: one built checkout,
  one Node, one composition of five synthetic rows.
- Claims are `tool`-kind only.
- The coordinator is in-memory and per-process; two processes have disjoint tables
  by design and nothing here speaks to them.
- The current planned run includes case D. Any scope reduction must be reviewed and recorded before execution, never used after a failed run to manufacture a pass.
- A synthetic throw is not a real-world cleanup failure: it proves the code path,
  not that any real disposer behaves this way.

## 9. Executed record — the one authorised attempt

Appended after the fact from `runs/20261102T150305Z-admission-loader/`. One launch, no
second attempt. Sources: `10-exact-command.txt`, `30-unit-stdout.log`, `32-summary.txt`,
`40-payload.log`, `41-arm.json`, `42-run.json`, `43-prepare.json`, `31-memory-peak.txt`,
`01`/`02`/`03-sources-*.sha256`/`.txt`, `05-preconditions.txt`, `00-run-attempt.sh`.

### 9.1 Invocation and observed envelope

Unit `admission-loader-20261102T150305Z`, `unit_exit=0`, runtime root
`…/admission/work/run-20261102T150305Z` retained after the run
(`runtime_root_exists_after=yes`). Envelope as reported by the unit itself:

| Knob | Observed | Where |
|---|---|---|
| `Type` | `exec` | `30-unit-stdout.log` `type=exec` |
| `MemoryMax` | `memory.max=805306368` | same line |
| `MemorySwapMax` | `swap.max=0` | same line |
| `TasksMax` | `pids.max=32` | same line |
| CPU | `cpu.max=50000 100000` | same line |
| `RuntimeMaxSec` | `runtime.usec=120000000` (120 s); the line also prints raw text `runtime.raw=2min` | same line |

The wrapper contains exactly one `systemd-run` invocation and the payload log contains each
step line exactly once (`heap-probe`, `prepare`, `arm`, `validate`). No retry is evidenced.

### 9.2 Host capacity gate and heap probe

- Gate, read inside the unit: `MemAvailable=1428336kB` (**1394 MiB**) ≥ 1200 MiB.
- Deviation: the wrapper also reads `/proc/meminfo` with a **host `awk`**, outside the unit,
  for `05-preconditions.txt` (`meminfo_read_here_is_informational_only=1428560`). This
  contradicts the instruction that every `awk` live inside the unit. It is recorded here as a
  deviation; it did not gate the launch, and only the in-unit read is the gate.
- Heap probe: `measure=v8-total-heap-size-limit`, `heapSizeLimit=603979776` (576 MiB) ≥
  `floorMib=384`, with `oldSpace="not-measured"` — a V8 total-heap limit, not an old-space
  measurement (`--max-old-space-size=384` was requested by `NODE_OPTIONS`).

### 9.3 Steps and verdict

| Step | rc | Note |
|---|---|---|
| `heap-probe` | 0 | `40-payload.log:2` |
| `prepare` | 0 | `40-payload.log:8` |
| `arm` | 0 | `40-payload.log:31` |
| `validate` | 0 | `40-payload.log:40`, ends `payload-ok: validator accepted this run` |
| launcher | 0 | `payload rc=0`; unit exit 0 |

`run.json` re-checks zero exits for the three steps that produce records (`heap-probe`,
`prepare`, `arm`, each `raw:"0"`, `zero:true`); the validator's own step is outside its own
check by construction. `selfCheck.passed=true`, `problems:[]`, `handoffProblems:[]`.

### 9.4 Coverage

`41-arm.json`: `type=admission/arm`, `status=passed`, **57 assertions, all `ok:true`**.
`42-run.json`: `type=admission/run`, `status=passed`, `assertionCount=57`,
`coveredAssertions` and `expectedAssertions` both hold the same 57 ids (as sets equal; the
stored order differs), `missing`/`unexpected`/`duplicates`/`failed`/`skipped` all empty,
validator line `coverage expected=57 covered=57`.

The §6 group counts were a plan-time estimate and **undercount**. Actual:
`inputs-*` 1 (not 2), `prepare-*` 1, `shared-coordinator-*` 3, `source-unmodified-*` 2,
`a-*` 21 (not 19), `b-*` 10 (not 9), `c-*` 10 (not 9), `d-*` 6 (not 5), plus
`teardown-gate-opened-before-dispose`, which §6 never listed, `host-teardown-settled`, and
the sentinel `expected-assertions-all-present` (`expected=56`, `expectedWithSentinel=57`,
`observed=56`). The persisted 57-item list is what determines coverage; the historical counts
in §6 do not.

### 9.5 Case outcomes as observed

- **A** — while gated `lifecycle.alphaWhileGated=loading` with 1 activation callback already
  entered, 0 native registers, tool absent, claim held (`ERR_ADMISSION_CONFLICT`); after the
  gate opened `alphaAfterAdmit=active`, 1 callback, 1 register, probe answered
  `alpha/1: ping`. Cleanup was collected by Cordis and invoked once, close settled
  `fulfilled`, the exact native disposer ran once; claims released.
- **B** — refused with `ERR_ADMISSION_CONFLICT`, **0** callbacks, **0** registers, fiber
  `failed`; the retry on a fresh generation 3 was admitted with 1 callback, 1 register, probe
  `beta/3: pong`.
- **Stale close** — `samePromise=true`, already `fulfilled`; B's claim still held and B's
  registration identity unchanged (`obj#5` before and after).
- **C** — Loader unload resolved `fulfilled` **while** the close promise rejected with
  `ERR_CLEANUP_SCOPE_FAILED` (`AggregateError`); the counted disposer ran exactly once; the
  claim stayed held; gamma was refused `ERR_ADMISSION_CONFLICT` with 0 callbacks and 0
  registers.
- **D** — the row entered and registered, fiber `failed`, the SAME error object
  (`SyntheticActivationFault`) was rethrown with `aggregateSize=0`, the rollback ran the exact
  register disposer once, no tool was left, and the claim stayed quarantined.
- **Teardown** — `teardown-gate-opened-before-dispose`, `host-teardown-settled=fulfilled`,
  `ctxAbsent=false`.

### 9.6 The memory number — what it is and is not

The sampler lives in `00-run-attempt.sh`, i.e. **outside the unit**: it polls this unit's own
cgroup `memory.peak` / `memory.current` every 0.1 s while the unit task is alive, and stops
when it exits (37 sample lines). The maximum observed is **174071808 bytes (≈166 MiB)**. That
is a *sampled* cgroup highwater and therefore only a **lower bound** on the final peak: it is
neither guaranteed to be the final peak nor an in-unit measurement. The post-exit read found
`memory.peak=unavailable (unit collected)`, so a final peak was **not collected**. This is a
deviation from the plan, which asked for an in-unit measurement after the run.

No assertion depends on these figures, and none of them is a duration claim.

### 9.7 Source integrity — selected hashes only

`01`/`02-sources-*.sha256` list the same 21 files (slice scripts, `lib/`, `fixtures/`, plus
`projects/dsh-plugin-kit/src/admission.js` and `src/cleanup.js`); every digest is identical
before and after and `03-sources-diff.txt` is empty (0 bytes). The arm's
`source-unmodified-before`/`-after` share digest `f52d622d…` over 12 files. This is a check of
**selected** files only: there is no whole-host hash, no filesystem-wide integrity check, and
no side-effect inventory, so nothing here supports a "no side effects" or "host untouched"
claim.

### 9.8 Deviations from the plan, recorded rather than smoothed over

1. A host `awk` read `/proc/meminfo` in the wrapper (§9.2), contrary to the all-`awk`-inside
   instruction; recorded as informational only.
2. Memory was sampled outside the unit instead of in-unit after the run (§9.6); the final peak
   is unknown, not "small".
3. Verified configuration, **not a deviation**: the unit printed `runtime.raw=2min` alongside
   `runtime.usec=120000000`; the requested `RuntimeMaxSec=120` and parsed readback agree.
4. §6's group counts undercount the delivered assertion set (§9.4).

### 9.9 What this executed attempt still does not establish

- No cryptographic signature, provenance attestation or security certification attaches to
  these records; 57 green assertions are a fixture result, not a certificate.
- No generated-template or plugin-scaffold integration was exercised.
- No Web, no browser, GUI or `dsh` CLI, no full application boot: one built checkout, one
  Node, one composition of five synthetic rows.
- No cross-version or cross-repo comparison; `DSH_COMPAT_SPEC` is untouched.
- `tool`-kind claims only, in one in-memory per-process coordinator.
- Case D is a synthetic throw: it proves the rollback code path, not real disposer behaviour.
- The shared-coordinator token is a diagnostic label; module identity rests on the observed
  object and resolved URL, not on authenticity proof.
