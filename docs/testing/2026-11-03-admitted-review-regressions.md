# Admitted-template slice — two frozen test files under a read-only sandbox (2026-11-03)

**Status: EXECUTED, ONCE — PASSED (16 tests, 16 pass, 0 fail, 0 skipped, 0 cancelled,
0 todo). Launcher exit 0. Raw evidence retained. One attempt, no retry. This is
text-source regression + pure filesystem test evidence only: it is NOT full arm
runtime evidence and NOT Loader success.**

§1–§6 were written *before* the attempt (skeleton pre-registered, unmodified
afterwards except this status line); §7–§12 were then filled in from the single
launch's own artifacts.

## 1. Authority and role of this record

Sole execution worker, **one attempt, no retry, no fix, no delegation**. Scope is
**exactly two frozen test files** and nothing else:

1. `experiments/dsh-live-lab/admitted-template/tests/layout.test.mjs`
2. `experiments/dsh-live-lab/admitted-template/tests/review-regressions.test.mjs`

Explicitly **out of scope** for this record:

- `experiments/dsh-live-lab/admitted-template/tests/arm-contract.test.mjs` — belongs to
  a different worker; it exists in the same directory and is **not** executed here;
- the cross-repository protocol validator;
- **anything Loader**: no Loader, no Cordis fiber, no arm boot, no host, no plugin
  runtime.

This record therefore claims **only** what the two files can support: a
**text-source regression check** (`review-regressions.test.mjs` reads `../arm.mjs` as
text and asserts on its source shape) plus **pure filesystem/unit tests**
(`layout.test.mjs` exercises `../lib/layout.mjs` against `mkdtemp` directories under
`tmpdir()`). **It does NOT claim full arm runtime behaviour and does NOT claim Loader
success.** A pass here is *source-shape + pure-function* evidence only.

No source is written: this envelope performs **test execution plus fresh evidence and
record writes only**. No `src/`, `tests/`, `lib/`, `arm.mjs`, fixture, or template is
edited, generated, or repaired.

### 1.1 Reference envelope

Established shape reused from
`runs/20261103T141847Z-admitted-template-recheck/` (and its record
`2026-11-03-admitted-template-recheck.md`), with the test list reduced from 13 files
to the 2 named above.

## 2. Run identity (pre-registered)

| field | value |
|---|---|
| prepared (local) | 2026-11-03T22:47+08:00 (before the attempt) |
| repo HEAD | `effb9581687f995841d872304e03627473039957` |
| node | `/www/server/nodejs/v24.21.0/bin/node` (identity from install path; version **not probed**) |
| systemd | `degraded` (pre-existing stale `rc-local.service`) |
| preflight MemAvailable | 1613892 kB (1576.1 MiB) — *survey only, **NOT** the gate* |
| competing workers | NONE (no `node --test`, no `bwrap`, no `systemd-run`, no `render-reference`) |
| stale transient units (`recheck*`/`refgen*`/`admitted*`/`review*`) | NONE |
| production listener `:3080` | untouched; nothing stopped to make room |

The availability gate is evaluated **exactly once, inside the unit**, with a single
`MemAvailable` sample and no polling.

## 3. The single invocation (pre-registered)

One `systemd-run` unit, launched once, `--wait --pipe --collect`:

```
systemd-run --quiet --wait --pipe --collect --unit <unit> \
  --service-type=exec \
  --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=CPUQuota=50% --property=RuntimeMaxSec=120 \
  --working-directory=<slice> \
  -- /bin/bash <run dir>/20-outer-wrapper.sh <unit> <run dir>
```

`ExecStart` is the host-side wrapper invoked **explicitly through `/bin/bash`** —
never by relying on the script's own mode/exec bit — because the scripts are installed
`0600` and a `0600` file cannot be `exec`'d as a program.

### 3.1 Sandbox shape (no host writable bind)

```
bwrap --ro-bind / / --proc /proc --dev /dev \
      --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent \
      --clearenv --tmpfs /tmp \
      -- /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp /bin/bash <payload>
```

- `/` read-only over the whole filesystem; pid/net/ipc/uts private.
- `--tmpfs /tmp` is the **only** writable filesystem.
- **No `--bind` of any kind**: there is **no writable host path whatsoever**. Both
  tests read sources and write only inside `mkdtemp` directories under `tmpdir()`.
- All logging is done host-side by the outer supervisor through `systemd-run --pipe`;
  the sandbox writes no log file.

### 3.2 Payload order (strict; no step skipped silently)

1. read effective cgroup limits from the payload's own cgroup;
2. **one** `MemAvailable` sample; `>= 1200 MiB` required, else `GATE=REFUSED`, exit 91,
   **no test runs** (gate is inside, no polling);
3. `rlimit`/taskshape report only (no re-launch);
4. verify **both** literal test files exist (`-f`) — any missing ⇒ exit 93;
5. verify the frozen input digests (`arm.mjs`, `lib/layout.mjs`, both test files)
   against values pinned in §4.2 — mismatch ⇒ exit 94, suite does not run;
6. `node --max-old-space-size=384 --test --test-concurrency=1 <2 literal files>` — **once**;
7. read peak/accounting counters before the unit can be collected.

## 4. Exact files under test (literal paths, no glob)

`cwd = experiments/dsh-live-lab/admitted-template`

1. `tests/layout.test.mjs`
2. `tests/review-regressions.test.mjs`

Named literally so that a file appearing in `tests/` cannot silently join this
attempt. `tests/arm-contract.test.mjs` is present in the same directory and is **NOT**
executed here.

### 4.1 Frozen inputs, digests pinned before execution (both re-hashed after)

| file | sha256 (pre-registered) |
|---|---|
| `arm.mjs` | `664f389a6d778c3712cc07b69ed7cc7d467d6a9e15ef5108ecd110b6e0ecc178` |
| `lib/layout.mjs` | `7290e27bfb7cafa6a05a3c001af4c83fb578614a9c1fab010e74de390f1b60d4` |
| `tests/layout.test.mjs` | `31a66b4b677df2e5e50facb0091815c837a3fc7a918d801f1ed91e57133ba5de` |
| `tests/review-regressions.test.mjs` | `46d159c7ba888bb27888f0a48eaa7f6947c11b8ad2edb9aba249ac0f7af87f65` |
| `tests/arm-contract.test.mjs` (out of scope, recorded only) | `38a6f13254a6922dd295cdc8f1509c52e118dbff8b07d732ba14cc824266b890` |

### 4.2 What each file actually proves (stated before the run)

- `layout.test.mjs` — 11 `test()` cases over `lib/layout.mjs`: pure rules plus
  filesystem refusal paths exercised against `mkdtemp` directories; one labelled
  **SOURCE-SHAPE** assertion reads `lib/layout.mjs` as text for the unreachable
  `ENV_PREPARE` branch. **Pure function + filesystem only.**
- `review-regressions.test.mjs` — 5 `test()` cases that `readFileSync` `../arm.mjs`
  **as text** and assert on source shape (guard-before-import ordering, failure
  overriding prior status, pre-sentinel count, consumer refusal code, duplicate
  service error). **Text-source regression only; nothing is imported, booted or run.**

## 5. What would make this record invalid

- more than one launch, a retry, or a fix applied between launch and record;
- a test file added to, or removed from, the list in §4;
- any writable path in the sandbox other than the tmpfs `/tmp`;
- a gate sample taken more than once, outside the unit, or re-polled;
- claiming **arm runtime** evidence or **Loader** success from these two files;
- a skipped/cancelled test reported as a pass.

## 6. Deliberately NOT RUN

- `tests/arm-contract.test.mjs` (other worker's file);
- the cross-repository protocol validator;
- any Loader / Cordis fiber / arm boot / host / plugin runtime;
- any install, build, `npm`, or network access.

---
<!-- ===== everything below is filled in AFTER the single launch, from raw artifacts only ===== -->

**Status: EXECUTED, ONCE — PASSED (16 tests, 16 pass, 0 fail, 0 skipped). Launcher
exit 0. No retry was made. This is text-source regression + pure filesystem test
evidence only — NOT full arm runtime, NOT Loader.**

## 7. Result

One launch, one test run, no retry. Launcher (`systemd-run --wait`) exit status **0**;
the unit was `--collect`ed and is gone from the manager (`Result=success`,
`LoadState=not-found`).

### 7.1 The suite, verbatim from the unit's stdout

```
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 322.245292
ENVELOPE TESTS_EXIT=0
```

Per file (11 + 5 = 16, matching the pre-registered `test()` counts):

| file | cases | observed |
|---|---|---|
| `tests/layout.test.mjs` | 11 | all `✔` — 10 pure-function/filesystem cases over `mkdtemp` dirs, plus `SOURCE-SHAPE: readRuntime keeps the fixed parent and still refuses an override` (`1.88408 ms`) |
| `tests/review-regressions.test.mjs` | 5 | all `✔` — text-source assertions over `../arm.mjs` (guard-before-import, failure-overrides-status, pre-sentinel count, consumer refusal code, duplicate service error) |

`stderr` was **0 bytes**. Suite wall time 322 ms; unit lifetime 22:45:20 → 22:45:21
≈ **1 s** of the 120 s cap.

The `reason` this suite has no framework skips is that neither file has optional
branches: `layout.test.mjs` exercises both `ok` and refusal outcomes via
`mkdtemp`, and `review-regressions.test.mjs` only reads text. No test here was
early-returned, and none of them boots anything.

### 7.2 Frozen inputs verified inside the envelope, by digest

Not by presence only: 4 pre-registered digests were re-checked **inside** the
sandbox before the suite ran, `frozen.mismatches=0`, `FROZEN_INPUTS=OK_4_FILES`:

| file | sha256 (matches §4.1 exactly) |
|---|---|
| `arm.mjs` | `664f389a6d778c3712cc07b69ed7cc7d467d6a9e15ef5108ecd110b6e0ecc178` |
| `lib/layout.mjs` | `7290e27bfb7cafa6a05a3c001af4c83fb578614a9c1fab010e74de390f1b60d4` |
| `tests/layout.test.mjs` | `31a66b4b677df2e5e50facb0091815c837a3fc7a918d801f1ed91e57133ba5de` |
| `tests/review-regressions.test.mjs` | `46d159c7ba888bb27888f0a48eaa7f6947c11b8ad2edb9aba249ac0f7af87f65` |

`ENVELOPE GENERATION=NOT_RUN (by design)` — these two files need no generated tree.

## 8. Envelope actually applied (readbacks, not launch claims)

Manager readback from the unit's own `ExecStart`, host namespace, before any work
(`OUTER` block, `systemctl show` rc=0):

| property | readback |
|---|---|
| `Type` | **`exec`** |
| `RuntimeMaxUSec` | **`2min`** (= 120 s) |
| `TimeoutStartUSec` | `1min 30s` (systemd default, not requested) |
| `MemoryMax` | `805306368` (= 768 MiB exactly) |
| `MemorySwapMax` | `0` |
| `TasksMax` | `32` |
| `CPUQuotaPerSecUSec` | `500ms` |
| `ActiveState`/`SubState` | `active`/`running` |

Kernel cgroup readback from inside the payload's own cgroup
(`/system.slice/review-1793717120.service`, same path on both sides):
`memory.max=805306368`, `memory.high=max`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`, `cpu.weight=100`, `memory.oom.group=0`.
Payload-observed rlimits: `nproc=15509`, `nofile=1024` (inherited, not the binding
constraint — `pids.max=32` is).

Sandbox shape, observed from inside: `pid:[4026532322]`, `net:[4026532323]`,
`ipc:[4026532321]`, `uts:[4026532320]`, `mnt:[4026532319]`; `pid1.comm=bwrap`; the
payload itself is `pid=2 ppid=1`. Host pid namespace, read before bwrap:
`pid:[4026531836]` — **distinct** from the sandbox's `pid:[4026532322]`, directly corroborating PID namespace separation. The command requests network/IPC/UTS isolation and the payload records their namespace identifiers, but no corresponding host identifiers were captured for a direct comparison. `/` mounted `ro,nosuid,nodev,relatime`; a fresh
writable tmpfs over `/tmp` (`mktemp -d` succeeded, `tmp.usable=/tmp/review.Bo7BPy`).

Environment: `env -i` — the only inherited variables are `HOME=/tmp`,
`PATH=/usr/local/bin:/usr/bin:/bin` (plus `PWD`/`SHLVL`/`_` set by bash itself).

Writability, by `access(W_OK)`, which writes nothing — **no host path is writable**:

| path | writable |
|---|---|
| `experiments/dsh-live-lab/admitted-template/` | **NO** |
| `…/admitted-template/tests/` | **NO** |
| `…/admitted-template/lib/` | **NO** |
| `projects/dsh-plugin-kit/src/` | NO |
| `projects/dsh-plugin-kit/docs/` | NO |
| `experiments/` | NO |
| `/tmp` | **YES** (tmpfs — the only writable filesystem) |

Gate: **one** `MemAvailable` sample inside the unit, `1634276 kB` = **1596.0 MiB**
against the `1228800 kB` (1200 MiB) floor ⇒ `GATE=PASS`, `reads=1 polls=0 retries=0`.
The sample and the decision are adjacent in the log with no loop around them; no
second sample exists anywhere in the run.

Peaks, read inside before the unit exited: `memory.peak=45850624` (**43.7 MiB** of
768 MiB), `memory.swap.peak=0`, `pids.peak=17` of the 32 limit with
`pids.events max=0` (nothing was ever refused a fork), `memory.current=17682432`,
`memory.events` all zero including `oom_kill=0` and `max=0`, CPU `usage_usec=384961`,
`nr_throttled=6` of `nr_periods=8`, `throttled_usec=376004`, `memory.pressure` flat at
`avg10=0.00` on both `some` and `full`. Journal: `Started` → `Deactivated
successfully`, no `Result=` failure.

## 9. Deviations, stated explicitly

1. **Scope reduced 13 → 2 files.** The reference envelope ran the 12 kit tests plus
   `layout.test.mjs`; this record runs only the two frozen slice files it was
   authorized for. Everything that made up the other 11 files is **absent**, so the
   200-test result of the reference run is **not** re-established here.
2. **Working directory is the slice**, not `projects/dsh-plugin-kit`: both tests
   resolve their imports relative to `import.meta.url`, so cwd is incidental, but it
   is different from the reference invocation and is recorded as such.
3. **No generation step, no template binding.** Nothing is rendered; no `templates/`
   bind exists (the reference envelope did not bind it either — both are fully
   read-only, `/tmp` tmpfs only).
4. **`/bin/bash` named explicitly** as `ExecStart`, so the `0600` scripts are never
   depended on as `exec`-able files.
5. **Mislabeled probe line (interpretation corrected, not re-run).** The payload
   printed `ENVELOPE host.ns.pid=…` by reading `/proc/1/ns/pid` *after* entering
   bwrap, so that line reports the **sandbox's** pid-1 namespace
   (`pid:[4026532322]`), identical to `ns.pid` — it is **not** a host measurement.
   The genuine host-namespace reading is the pre-bwrap
   `OUTER self.ns.pid=pid:[4026531836]`. The comparison in §8 uses the correct
   pair. The label was left wrong in the raw log rather than edited after the fact.
6. **`70-post-attempt.txt` lists a stale digest for itself.** Its
   `sha256sum *` index ran inside the same redirect that was still writing the file,
   so the value it prints for `70-post-attempt.txt`
   (`101a6442…`) is a truncated-write artifact. The true final digest is
   `9c1e1e1facc5ccab9c5b3bfd512d852f800cb000170f0e1e74af6ae9896cfa19` (§11). No file
   was rewritten to "fix" this; the discrepancy is recorded.
7. **Journal has no `Consumed … memory peak` line** this time (the reference run had
   one). The cgroup peaks were captured from inside and from the still-alive unit
   instead; nothing was inferred to fill the gap.
8. **`pids.peak=17` vs the reference's `pids.peak=32`** — this suite spawns no
   nested runner (no `node --test` inside a test), so it approaches nowhere near the
   `TasksMax` ceiling. Not a claim about any other suite.

## 10. Source integrity

`11-hashes-before.txt` vs `50-hashes-after.txt`, compared as a path→digest map with
the slice root normalized: **30 of 30 hashed paths digest-identical, 0 changed.**
Those 30 are: all 13 files of the `admitted-template` slice (including the
out-of-scope `tests/arm-contract.test.mjs` and all 6 fixtures), the 2 test files and
2 source inputs re-listed individually, and the 9 `projects/dsh-plugin-kit/src/`
entries plus `package.json`.

The 2 in-envelope `test.file.sha256=` lines and the 4 `frozen.match=` lines pin the
exact bytes executed by the run itself. No writable host path existed inside the
sandbox, so no source *could* have been written by the suite; this comparison is the
independent check of that.

Post state: unit collected (`LoadState=not-found`, `Result=success`, cgroup dir gone),
no `bwrap`/`node --test`/wrapper leftovers, production listener on `:3080` unchanged
(`LISTEN 127.0.0.1:3080`, pid 359980), only the pre-existing failed `rc-local.service`
remains failed, host `MemAvailable` 1660044 kB after. One line in the leftover-process
scan matched the orchestrator's own parent shell
(`bash -c cd /tmp/review-stage && bash ./10-orchestrator.sh`) — that is the harness
command itself, not a stray process.

## 11. Evidence index

Raw evidence:
`projects/dsh-plugin-kit/docs/testing/runs/20261103T144520Z-admitted-review-regressions/`

| file | sha256 | content |
|---|---|---|
| `00-preflight.txt` | `975dc71612888bfb74117500ba77d70434e3fd7a3c8e7210ed867219baeee99e` | host survey, before the attempt (context only, not the gate); `competing workers: NONE` |
| `10-orchestrator.sh` | `f01f84d668d5bacc97da02ae364e9525311a198ef24aff599a74677d5147fbf1` | host-side supervisor as executed (mode 0600) |
| `11-hashes-before.txt` | `c070eaa610ea5e1131bfb242568365ac93503d598ec37afe47f2b6595dc6f600` | source digests before, incl. the 2 files individually |
| `12-invocation.txt` | `cc7ad6315bdf2318c6f82188cb5983c6d774fb18b37871daa0aa31671b09e164` | the single `systemd-run` argv, element by element, plus the 2 test paths and the out-of-scope path |
| `20-outer-wrapper.sh` | `88a31191468ef95caadcec58c94d6706711acd5e27713fd4ba23af8356aeb755` | the unit's `ExecStart`: manager + cgroup readback, host digests, then bwrap (mode 0600) |
| `21-envelope-runner.sh` | `2f7fc9ddd7c9b7007655f3792f164623ae424d77edae569597c75abdeeca5b2c` | the in-sandbox payload: limits, shape, gate, 2 files, frozen digests, one test run (mode 0600) |
| `30-unit-stdout.log` | `e09db1c7e935400d06150fca272f9d9ecd30dd635d25fdb6d826ea5454f67841` | verbatim stdout: `OUTER` readbacks, all `ENVELOPE` lines, full test output, peaks |
| `31-unit-stderr.log` | `e3b0c442…b855` (empty) | verbatim stderr — **0 bytes** |
| `40-launch-exit-status.txt` | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` | `0` |
| `50-hashes-after.txt` | `0311b41fd199eee0e04a42cf73e549ee04f682cb738d1253d04b09c1f859ab54` | source digests after |
| `60-journal.txt` | `5c82bc4cbf485aa62622e3230280385a0c9c3035a904af4d21a75d7166861762` | journal for `review-1793717120.service` |
| `70-post-attempt.txt` | `9c1e1e1facc5ccab9c5b3bfd512d852f800cb000170f0e1e74af6ae9896cfa19` | post state: unit collected, no leftovers, `:3080` unchanged, meminfo, self-stale digest caveat (§9.6) |

Unit `review-1793717120.service` was `--collect`ed and is gone from the manager.

## 12. What this does and does NOT establish

**It does say:** on these frozen bytes, inside this envelope, the two named files
pass 16/16 in 322 ms, with the suite's `arm.mjs` and `lib/layout.mjs` inputs proven
identical to their pre-registered digests, and with no writable host path available
to the suite.

- `layout.test.mjs` establishes **pure-function and filesystem-refusal behaviour** of
  `lib/layout.mjs` (root shape, alias spellings, symlink and dangling-symlink refusal,
  fresh-child acceptance), exercised against `mkdtemp` directories — plus one
  explicitly labelled **SOURCE-SHAPE** assertion for the `ENV_PREPARE` branch that
  cannot be reached without creating the slice's fixed `work/`.
- `review-regressions.test.mjs` establishes **text-source regressions only**: that
  `arm.mjs` still contains the five asserted source shapes. It does not import,
  boot, or execute `arm.mjs`.

**It does NOT say:**

- **not full arm runtime** — nothing here boots the arm, resolves its peers, or runs
  a handoff; `arm.mjs` is inspected as a string;
- **not Loader success** — no Loader, no Cordis fiber, no plugin runtime, no host;
- **not validator** — the cross-repository protocol validator was neither imported
  nor run;
- **not `arm-contract.test.mjs`** — that file belongs to another worker, sits in the
  same directory, and was not executed (only hashed, unchanged);
- not a load-capacity benchmark: this suite peaks at 43.7 MiB and 17 tasks, below the memory and task ceilings. CPU throttling was observed in 6 of 8 periods, so it would be incorrect to claim the workload was far from every cap; no throughput or latency guarantee follows;
- not a re-establishment of the reference run's 200-test result, which covered 11
  other files that are out of scope here.
