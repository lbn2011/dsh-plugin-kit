# Managed lifecycle regression — 13 test files, one bounded unit (2026-11-02)

Status: **the bounded envelope passed — `169/169` tests, `node` exit `0`, unit exit `0`,
`memory.peak = 76361728 B` (≈ 72.82 MiB).** This file records *only* that envelope. It
does not record a real Loader launch, a managed teardown, or any plugin host boot; those
are `unobserved` here and are the subject of the separate Loader recheck.

This document is written from the persisted evidence in
`reports/2026-11-02-managed-lifecycle-regression/` — the unit's own log, its wrapper
script, the hash manifests and the cgroup accounting. Nothing below is derived from
memory of the run, and the regression was **not re-run** to produce this file.

## 1. What ran, and where the numbers come from

| item | value | evidence source |
| --- | --- | --- |
| unit | `dsh-managed-lifecycle-regression` | `20-invocation.txt`, log line 2, log line 5 |
| type / limits issued | `Type=exec MemoryMax=768M MemorySwapMax=0 TasksMax=32 CPUQuota=50% RuntimeMaxSec=120 TimeoutStopSec=15` | `20-invocation.txt` `PROPERTIES=` |
| payload | `/bin/bash reports/2026-11-02-managed-lifecycle-regression/21-envelope-script.sh` | `20-invocation.txt` `PAYLOAD=` |
| interface | one `node --test --test-concurrency=1`, **8 kit files + 5 fixture files = 13 files**, all under one `bwrap` | log line 22, log lines 63–68 |
| tests executed | `169` | log line 238 |
| pass / fail | `169` / `0` | log lines 240–241 |
| node exit code | `0` | log line 314, and `22-envelope-log.txt.rc` = `0` |
| window | `2026-11-01T17:30:53Z` → `2026-11-01T17:30:59Z` (≈ 6 s wall) | log lines 1, 315 |
| test wall time | `5544.599905 ms` | log line 245 |

### 1.1 The file count is 13 — the derived summary says 0, and that is a report defect

The invocation itself is unambiguous. The log's own line is:

```
TEST_FILES kit=8 slice=5 total=13
```

and the runner emitted 169 tests across 13 files, in one process
(`--test --test-concurrency=1`), after the wrapper's existence loop verified every one
of the 13 paths (`MISSING_TEST=…` never fired; the loop is at `21-envelope-script.sh`
lines 42–44, the count line at line 45).

The derived summary file `23-test-summary.txt` nevertheless opens with:

```
TEST_FILES=0
8 slice
```

**Both lines are defects in the derived report, not facts about the run.** The `0` is a
parse failure — the log line is `TEST_FILES kit=8 slice=5 total=13`, so a parser that
expected a bare integer harvested `0`; the stray `8 slice` is the residue of the same
mis-parse. The **actual file count is 13 (8 kit + 5 fixture)**, taken from the
invocation line and from the runner's own file table, both of which agree with the
per-file counts in §1.2. The malformed summary is preserved unedited as evidence of the
defect; it must not be cited as `TEST_FILES=0`.

### 1.2 Per-file test counts (from the run's file table)

| file | tests | side |
| --- | --- | --- |
| `cleanup` | 21 | kit |
| `cli` | 16 | kit |
| `exports` | 5 | kit |
| `managed-registration` | 15 | kit |
| `managed-template` | 17 | kit |
| `protocol` | 15 | kit |
| `scaffold` | 17 | kit |
| `template` | 5 | kit |
| `counted-disposer` | 9 | fixture |
| `fixture-lifecycle-contract` | 7 | fixture |
| `prepare-generated-parent` | 6 | fixture |
| `read-only-boundary` | 13 | fixture |
| `validate-records` | 23 | fixture |

kit subtotal = `111`, fixture subtotal = `58`, total = `169`. The two subtotals and the
runner's `ℹ tests 169` agree; that agreement is what makes the `TEST_FILES=0` line
self-evidently a defect rather than a partial run.

## 2. Effective limits — read from the actual unit, not from the request

The limits below were read **inside the workload unit** (`/proc/self/cgroup` →
`/sys/fs/cgroup/system.slice/dsh-managed-lifecycle-regression.service`), before any test
work, and again cross-checked from inside `bwrap`:

```
CGROUP_RAW=0::/system.slice/dsh-managed-lifecycle-regression.service
CGROUP_LIMIT memory.max=805306368
CGROUP_LIMIT memory.swap.max=0
CGROUP_LIMIT memory.high=max
CGROUP_LIMIT pids.max=32
CGROUP_LIMIT cpu.max=50000 100000
CGROUP_LIMIT cgroup.type=domain
INNER_CGROUP=0::/system.slice/dsh-managed-lifecycle-regression.service
```

Requested and observed therefore agree: `768 MiB` → `805306368` bytes; swap off → `0`
(exact); `TasksMax=32` → `pids.max=32`; `CPUQuota=50%` → `50000 100000`. The inner read
matching the outer read shows the sandbox did not move the process into a different
cgroup — it is the same unit's own tree.

### 2.1 Accounting from that unit

| counter | value | note |
| --- | --- | --- |
| `memory.peak` | `76361728` B (≈ 72.82 MiB) | an **actual measurement** of this unit, ~9.5 % of the 768 MiB ceiling |
| `memory.swap.peak` | `0` | swap genuinely unused, consistent with `MemorySwapMax=0` |
| `memory.current` (at read) | `6848512` B | post-run remainder, not a peak |
| `pids.peak` | `32` | see §2.2 — **not** evidence of a fork denial |
| `cpu.stat` | `usage_usec 2883902`, `nr_periods 57`, `nr_throttled 56`, `throttled_usec 3479151` | the quota was the binding constraint during the run |
| `memory.events` | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` | no recorded events in these counters, including no OOM or OOM kill; this does not measure all memory-reclaim pressure |

### 2.2 `pids.peak = 32` does not prove a fork denial

`pids.peak` reports the highest **concurrent task count** in the unit's tree; it is a
level, not an event count, and this run did not read `pids.events`. `32` equals
`pids.max`, so the two readings are compatible with *either* (a) the workload genuinely
reached 32 concurrent tasks and any further fork was refused, or (b) the workload peaked
at exactly 32 with no refusal at all. Nothing in this evidence distinguishes them, so
this record claims neither. A refusal claim would need `pids.events`' `max` counter or a
`fork: retry` / `EAGAIN` from the workload; neither was captured.

Relatedly, `nr_throttled 56` against `nr_periods 57` shows near-continuous CPU throttling
during the run. That is a throughput observation only — it is not a failure, and no
timing target was ever asserted for this slice.

## 3. The capability readings are the outer supervisor's, not the sandbox's

`26-caps-and-environ.txt` (and log lines 14–19) report:

```
PID=274380 PPID=1
CAPS CapPrm:	000001ffffffffff
CAPS CapEff:	000001ffffffffff
CAPS CapBnd:	000001ffffffffff
CAPS NoNewPrivs: 0
CAPS Seccomp: 0
CAPS Seccomp_filters: 0
```

`PID=274380` is the **unit's main process** — the payload `/bin/bash` that systemd
started (`PPID=1`). The read happens at `21-envelope-script.sh` line 22, which is
**before** the single `bwrap` invocation at line 68, as the log ordering confirms (caps
at log lines 14–19, `=== BWRAP_BEGIN ===` at line 63).

Therefore these readings describe the **outer supervisor process**, and they are
**not proof about the sandbox**. `NoNewPrivs: 0` and full `CapEff` on the supervisor say
only that the transient unit itself grants no capability drop — the confinement in this
slice is `bwrap` (`--ro-bind / /`, `--unshare-pid/-net/-ipc/-uts`, `--die-with-parent`),
not a systemd capability/seccomp hardening profile. Any claim that "the confined process
ran without privileges" would need a status read from **inside** `bwrap`; it was not
taken. (By contrast, the 2026-11-01 parent-regression record does report `NoNewPrivs:1`
inside; that measurement is not transferable to this run.)

## 4. Integrity of the tree

`24-sources-sha256.txt` holds the unit's own two manifests: `SHA_BEFORE` and `SHA_AFTER`,
`38/38` files, **byte-identical**. The compared set covers the kit sources and
`package.json`, both template trees, `tests/managed-template.test.js`, the two fixtures,
`arm-fault.mjs`, `lib/layout.mjs`, `tests/fixture-lifecycle-contract.test.mjs`, and the
four vendored Cordis files (`lib/index.js`, `src/utils.ts`, `src/registry.ts`,
`src/fiber.ts`).

This is a 38-file selection, **not** the whole repository, and it is metadata evidence
that no compared file was rewritten during the run — it is not an enforcement boundary
and is not claimed as one. The read-only bind is what enforces; the hashes only make the
"nothing changed" observation checkable.

## 5. Disclosures carried forward

1. **`generator60bf` deviation (from `00-preflight.txt`).** The predecessor ended in
   internal analysis rather than delivery and self-reported a shell reconstruction of
   generator output that was not an authorized generation path. Per that preflight, its
   produced files and any hash it reported are treated as **UNVERIFIED** in this record;
   every claim above is re-derived from the checked-in tree and this run's own output.
   No claim in this document depends on the predecessor's numbers.
2. **`TEST_FILES=0` / `8 slice`** in `23-test-summary.txt` — a derived-report parse
   defect, §1.1. The underlying invocation and runner output are consistent at 13 files.
3. **Caps provenance** — outer supervisor only, §3.
4. **`pids.peak` interpretation** — level, not denial, §2.2.
5. **Host state at launch** — preflight recorded `SYSTEMD_STATE=degraded` (an unrelated
   `rc-local.service` failure pre-existed and was not touched).

## 6. What this does and does not support

| claim | supported here? | basis |
| --- | --- | --- |
| the kit + fixture suite passes under the 768 MiB / no-swap / 32-task / 50 %-CPU envelope | **yes** | 169/169, exit `0`, `memory.events` all zero |
| the run remembered a real memory figure | **yes** | `memory.peak = 76361728` B from the unit's own cgroup |
| the compared 38 files were untouched by the run | **yes** (as metadata) | identical `SHA_BEFORE`/`SHA_AFTER` |
| the confined processes ran with reduced capabilities | **no** | caps read from the outer supervisor only (§3) |
| the tasks ceiling ever refused a fork | **no** | `pids.peak=32` alone cannot show it (§2.2) |
| a real Loader boots, or the managed teardown works on a real host | **no** | no Loader, no payload, no DSH home in this unit |
| the managed template references real Loader cleanup integration | **no** | template *text* is exercised; the runtime is not |

## 7. Evidence index

| file | contents |
| --- | --- |
| `reports/2026-11-02-managed-lifecycle-regression/00-preflight.txt` | preflight versions, planned properties, disclosed `generator60bf` deviation |
| `…/10-gate.txt` | capacity gate (`1859236` kB ≈ 1815 MiB, `reads=1`) and the effective cgroup read |
| `…/20-invocation.txt` | unit name, issued properties, payload path |
| `…/21-envelope-script.sh` | the wrapper: cgroup read, gate, hash manifests, single `bwrap`, accounting dump |
| `…/22-envelope-log.txt` | the unit's full stdout/stderr (315 lines) |
| `…/22-envelope-log.txt.rc` | `0` |
| `…/23-test-summary.txt` | derived per-file table **and** the `TEST_FILES=0` defect |
| `…/24-sources-sha256.txt` | `SHA_BEFORE` / `SHA_AFTER`, 38/38 identical |
| `…/25-cgroup-envelope.txt` | `memory.peak`, `swap.peak`, `pids.peak`, `cpu.stat`, `memory.events` |
| `…/26-caps-and-environ.txt` | outer-supervisor caps (§3) |

**This regression was not re-run to produce this record.** A second run would need a new
authorized envelope and would be a separate decision, not a continuation of this one.
