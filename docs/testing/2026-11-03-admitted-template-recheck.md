# Admitted-template kit suite — recheck under a fully read-only sandbox (2026-11-03)

**Status: EXECUTED, ONCE — PASSED (200 tests, 200 pass, 0 fail, 0 skipped).
Launcher exit 0. No Loader evidence. No retry was made.**
§1–§6 were written *before* the attempt, as required. §7–§11 were then filled in
from the single launch's own artifacts. Nothing here comes from a retry — **one
attempt, no fix, no rerun**.

## 1. Authority and role of this record

Independent recheck executed by a **sole worker**, one attempt, **no retry, no fix,
no delegation**. It re-runs the same 13 literal test files as
`2026-11-03-admitted-template-unit.md` §4, against **frozen sources**, under a
strictly narrower sandbox: **no host path is writable at all**.

- No Loader, no Cordis fiber, no arm, no real host, no plugin runtime.
- No install, no build, no `npm`, no network, no production modification.
- No generation: the reference tree already exists and is treated as **frozen input**.
- No edit of `runtime/`, `tests/`, `src/`, or any other report.
- No new arm/validator test files are added and no launcher is written.

Tests that use mocks are reported as **kit + mock host**, never as Loader evidence.
Optional or cross-repo tests that early-return are reported as **skipped**, with the
reason the suite itself printed.

## 2. Run identity

| field | value |
|---|---|
| prepared (local) | 2026-11-03T22:17+08:00 |
| repo HEAD | `effb9581687f995841d872304e03627473039957` |
| reference tree | `projects/dsh-plugin-kit/templates/host-tool-admitted/` — **present and frozen** (7 files, 23785 bytes, 2 dirs; digests in §4.1) |
| node | `/www/server/nodejs/v24.21.0/bin/node` (identity from the install path; version **not probed**) |
| systemd | `degraded` (stale `rc-local.service`, pre-existing) — same as the reviewed run |
| preflight MemAvailable | 1460848 kB (1426.6 MiB) — *survey only, NOT the gate* |
| competing workers | NONE at pre-registration (no `node --test`, no `bwrap`, no `systemd-run`, no `render-reference`) |
| stale transient units | NONE |
| production listener `:3080` | untouched; nothing was stopped to make room |

The availability gate is evaluated exactly once, **inside** the unit, by the payload,
with a single `MemAvailable` sample and no polling.

## 3. The single invocation

One `systemd-run` unit, `Type=exec`, launched once with `--wait --pipe --collect`:

```
systemd-run --quiet --wait --pipe --collect --unit <unit> \
  --service-type=exec \
  --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=CPUQuota=50% --property=RuntimeMaxSec=120 \
  --working-directory=<kit> \
  -- /bin/bash <run dir>/20-outer-wrapper.sh <unit> <run dir>
```

`ExecStart` is the host-side wrapper invoked **explicitly through `/bin/bash`** — never
by relying on the script's own mode/exec bit — because the scripts are installed `0600`
and a `0600` file cannot be `exec`'d as a program. This is the same shape as the
reviewed `20261103T135946Z-admitted-template-unit` runner, minus generation and minus
any writable bind.

### 3.1 Sandbox shape (deliberately narrower than the reviewed run)

```
bwrap --ro-bind / / --proc /proc --dev /dev \
      --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent \
      --clearenv --tmpfs /tmp \
      -- /usr/bin/env -i PATH=... HOME=/tmp /bin/bash <payload>
```

- `/` read-only, **over the whole filesystem**; namespaces pid/net/ipc/uts private.
- `--tmpfs /tmp` is the **only** writable filesystem, for the whole sandbox.
- **No `--bind` of `templates/`**: unlike the reviewed run, the kit's `templates/`
  directory is *not* re-bound read-write. There is **no writable host path whatsoever**,
  because this attempt generates nothing. `src/`, `tests/`, `templates/`, `experiments/`
  and `docs/` are all read-only, so a test that tried to write a source would fail
  rather than corrupt the tree.
- All logging is done by the outer supervisor on the host through `systemd-run --pipe`;
  the sandbox writes no log file. Writes to the run directory are made **only** by the
  host-side orchestrator, outside the envelope.

### 3.2 Payload order (strict, no branch may be skipped silently)

1. read the effective cgroup limits from the payload's own cgroup;
2. **one** `MemAvailable` sample; `< 1200 MiB` ⇒ `GATE=REFUSED`, exit 91, no test runs;
3. verify the 13 literal test files exist — any missing ⇒ stop and report, exit 93;
4. verify the **frozen reference tree exists with the 7 pinned digests** — absent or
   differing ⇒ stop and report, exit 94, **the suite does not run** (no generation is
   possible in this envelope, so a mismatch is a hard stop, never repaired here);
5. read peak/accounting counters after the suite, before the unit can be collected;
6. `node --max-old-space-size=384 --test --test-concurrency=1 <13 literal files>` — once.

There is **no generation step** in this envelope, by construction.

## 4. Exact files under test (literal paths, no glob)

Kit (`cwd = projects/dsh-plugin-kit`), in this order:

1. `tests/admission.test.js`
2. `tests/admission-integration.test.js`
3. `tests/admission-provider.test.js`
4. `tests/admitted-template.test.js`
5. `tests/cleanup.test.js`
6. `tests/cli.test.js`
7. `tests/exports.test.js`
8. `tests/managed-registration.test.js`
9. `tests/managed-template.test.js`
10. `tests/protocol.test.js`
11. `tests/scaffold.test.js`
12. `tests/template.test.js`

Experiment slice:

13. `experiments/dsh-live-lab/admitted-template/tests/layout.test.mjs`

Named literally so that a file appearing in either `tests/` directory cannot silently
join this attempt. `experiments/dsh-live-lab/admitted-template/tests/arm-contract.test.mjs`
exists in that directory and is **NOT** one of the 13; it is not executed here.

### 4.1 Frozen inputs (declared before execution, re-hashed after)

`templates/host-tool-admitted/` — 7 files: `README.md`, `cordis.patch.yml`,
`declaration.json`, `index.js`, `jsconfig.json`, `package.json`, `test/plugin.test.js`.
Exact byte/line/sha256 table is appended after the attempt from
`50-hashes-after.txt`; the *expected* values are the ones pinned in
`2026-11-03-admitted-template-unit.md` §6.2 and were re-verified on the host at
pre-registration (all seven identical).

### 4.2 Source changes owned by other workers, present in these frozen sources

Recorded as context, **not** made or judged here:

- `tests/admitted-template.test.js` — the two assertions that failed in the reviewed
  run are now fixed: the render-set comparison sorts both sides (`:252`), and the
  byte-for-byte check compares the generated `README.md` rather than a
  `generated-readme.md` review-copy file. So the check that previously could not pass
  by generation alone is now aligned with the renderer's actual output.
- `tests/cli.test.js` — `generatedTest()` now runs `node test/plugin.test.js`
  **directly** instead of a nested `node --test` runner, which removes one process
  from the tree under `TasksMax`; it **retains the 20 s timeout** and now reports
  diagnostic error fields (`code`, `signal`, `killed`, `message`).

This record does **not** claim that the historical 20 s timeout is explained or
cured. A pass here, if it happens, shows only that this helper finished inside its
bound under this envelope.

## 5. What would make this record invalid

- more than one launch, a retry, or a fix applied between launch and record;
- a test file added to, or removed from, the list in §4;
- any writable path in the sandbox other than the tmpfs `/tmp`;
- a gate sample taken more than once, or taken outside the unit;
- a claim that a skipped test passed, or that a mock-host pass is Loader evidence;
- treating any of this as proof about the historical timeout's cause.

## 6. Deliberately NOT RUN

- anything Loader, arm, host, or plugin-runtime related;
- `experiments/dsh-live-lab/admitted-template/tests/arm-contract.test.mjs`;
- the generated project's own `test/plugin.test.js` as a standalone suite (the kit has
  no `node_modules`, so it cannot resolve `schemastery`/`dsh-tools`). It *is* read by
  the 13-file suite: `admitted-template.test.js` compares it byte for byte, and
  `cli.test.js` executes it against a throwaway stub `node_modules` in a temp dir —
  that is a **mock-host** check inside the kit suite, not the real dependency graph.

## 7. Result

One launch, no generation, one test run. **The suite passed: 200 of 200 tests, 0
failed, 0 skipped, 0 cancelled, 0 todo.** Launcher (`systemd-run --wait`) exit
status **0**; the unit was `--collect`ed and is gone from the manager.

The three tests that failed in the reviewed run of the same 13 files now pass. That
is a statement about *this* envelope on *these* frozen sources; §7.3 says exactly
how little it establishes.

### 7.1 The suite, verbatim from the unit's stdout

```
ℹ tests 200   ℹ pass 200   ℹ fail 0   ℹ cancelled 0   ℹ skipped 0   ℹ todo 0
ℹ duration_ms 6572.990191            ENVELOPE TESTS_EXIT=0
```

The runner reported 200 passes and no framework-level skips. This does not exclude early returns inside a test: the optional protocol integration case returned without importing the real validator (see §7.4). The total test count remains 200; this count is not a branch-coverage measurement.

The three tests that failed before, and their observed durations now:

| test | before | now |
|---|---|---|
| `admitted-template.test.js` — "is a third implemented catalog entry and renders the same seven files" | failed (order-sensitive) | `✔ 3.07 ms` |
| `admitted-template.test.js` — "the checked-in admitted reference matches the renderer byte for byte" | failed (`ENOENT generated-readme.md`) | `✔ 4.10 ms` |
| `cli.test.js` — "the generated project test passes once the shared host packages resolve" | failed at its own `20 000 ms` bound (`20121.9 ms`) | `✔ 276.94 ms` |

Suite wall time fell from `25805 ms` to `6573 ms`; the difference is almost entirely
the 20 s the previous run spent inside that one helper's timeout.

### 7.2 The frozen reference tree

Verified **inside** the envelope by digest, not merely by presence: 7 files, 23785
bytes, `reference.writable=NO`, `reference.mismatches=0`,
`REFERENCE=FROZEN_OK_7_FILES`. The tree was **not** generated, **not** touched, and
**not** writable — `ENVELOPE writable=.../templates/host-tool-admitted NO`. The 7
digests equal those pinned in `2026-11-03-admitted-template-unit.md` §6.2 exactly:

| file | bytes | lines | sha256 |
|---|---|---|---|
| `README.md` | 7670 | 161 | `fd7c839ed6d119aa58167f402f67cd70f4a03801bcffd3243776d2c476ae65b4` |
| `cordis.patch.yml` | 487 | 11 | `79479b0e6959305e5c3188e7596cb7b98332f2376c6522bc4c9a7c4ee9b736e7` |
| `declaration.json` | 339 | 21 | `9f504567788d90866678e11117ecbe10ab01758278fe34fcfa61c5c2d40db988` |
| `index.js` | 5496 | 125 | `9e2bb788bb3d7a2a533e406b009b62c888dfce7959c277f9660c11a4b65f175f` |
| `jsconfig.json` | 178 | 12 | `7885998456d4034e5e72324027fc1ba9727e9369d28348253c00e69f8df85c6e` |
| `package.json` | 840 | 32 | `bf93542fcb7edd481e1326a78041a6bbd1398846ccac7274626da2beca95428c` |
| `test/plugin.test.js` | 8775 | 173 | `3e4ae49a967285d4445fe4841bad7ba5861b751665dac81b80fa00df322c2811` |

The original attempt generated the reference before running its suite, so the directory already existed during that failure. The recheck corrected the erroneous `generated-readme.md` lookup and compared all seven actual rendered files, including `README.md`, without regenerating them.

### 7.3 What this does and does NOT establish

- It **does** say: with the reference tree present and frozen, and with the two
  admitted-template assertions and the `generatedTest()` helper in their current
  form, the 13 named files pass 200/200 inside this envelope in 6.6 s.
- It does **NOT** say why the reviewed run timed out. `generatedTest()` now runs
  `node test/plugin.test.js` directly instead of a nested `node --test` runner,
  which removes one process from the tree under `TasksMax=32`; the historical
  timeout is **not** attributed to that, and no experiment isolating process depth,
  CPU quota or node version was performed. In this run that helper finished in 277 ms
  under the *same* `CPUQuota=50%`, `TasksMax=32` envelope, with 69 of 71 periods
  throttled — which is consistent with several explanations and decides none.
- It says **nothing** about a Loader, an arm, a host, or a plugin runtime.
- **Mock host, not Loader.** Of the 200 tests: `admitted-template.test.js` imports
  the generated `index.js` with its two host imports replaced by one-line stand-ins
  and registers against a *labelled fake* `tools.register`; `cli.test.js` executes
  the generated `test/plugin.test.js` against a throwaway stub `node_modules` in a
  temp dir (`the generated project test passes once the shared host packages
  resolve`); `layout.test.mjs` is a pure source-shape/pure-function slice test against
  `mkdtemp` directories. A pass in any of those is **kit + mock host**, never Loader
  evidence — the real Loader arm worker (`worker11559`) stays `CODEONLY` and was not
  touched.

### 7.4 Optional / early-return accounting

`skipped 0` and `cancelled 0` are framework counters, not branch coverage. The wrapper uses `env -i` without `DSH_COMPAT_SPEC`; `tests/protocol.test.js:208-214` therefore asserts that variable is absent and returns without importing the real protocol validator. This run provides no cross-repository validator integration evidence. The admitted reference byte-comparison did execute: its directory existed during both the original failing attempt and this recheck.

## 8. Envelope actually applied (readbacks, not launch claims)

Manager readback from the unit's own `ExecStart`, in the host namespace, before any
work (`OUTER` block, `systemctl show` rc=0):

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
(`/system.slice/recheck-1793715527.service`, same path on both sides):
`memory.max=805306368`, `memory.high=max`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`, `cpu.weight=100`, `memory.oom.group=0`.

Sandbox shape, observed from inside: `pid:[4026532322]`, `net:[4026532323]`,
`ipc:[4026532321]`, `uts:[4026532320]`, `mnt:[4026532319]` — all distinct from the
host pid namespace (`pid:[4026531836]`), `pid1.comm=bwrap`. `/` mounted
`ro,nosuid,nodev,relatime`; a fresh writable tmpfs over `/tmp`
(`mktemp -d` succeeded, `tmp.usable=/tmp/recheck.wCnLJD`).

Writability, by `access(W_OK)`, which writes nothing — **no host path is writable**:

| path | writable |
|---|---|
| `projects/dsh-plugin-kit/templates/` | **NO** |
| `projects/dsh-plugin-kit/templates/host-tool-admitted/` | **NO** |
| `projects/dsh-plugin-kit/src/` | NO |
| `projects/dsh-plugin-kit/tests/` | NO |
| `experiments/dsh-live-lab/admitted-template/` | NO |
| `docs/` | NO |
| `experiments/` | NO |
| `/tmp` | **YES** (tmpfs — the only writable filesystem) |

Gate: **one** `MemAvailable` sample inside the unit, `1397460 kB` = **1364.7 MiB**
against the `1228800 kB` (1200 MiB) floor ⇒ `GATE=PASS`, `reads=1 polls=0
retries=0`. The sample and the decision are 10 lines apart in the log with no loop
around them; no second sample exists anywhere in the run.

Peaks, read inside before the unit exited: `memory.peak=70737920` (67.5 MiB of
768 MiB), `memory.swap.peak=0`, `pids.peak=32` (the pids limit was **reached**, and
`pids.events max=0` records that nothing was ever refused a fork because of it),
`memory.current=24424448`, `memory.events` all zero including `oom_kill=0` and
`max=0`, CPU `usage_usec=3540623`, `nr_throttled=69` of `nr_periods=71`,
`throttled_usec=4379452`, `memory.pressure` flat at `avg10=0.00`. Unit lifetime
14:18:47 → 14:18:54 ≈ **7 s** of the 120 s cap; journal: `Consumed 3.552s CPU time,
67.4M memory peak`, `Deactivated successfully`, no `Result=` failure.

## 9. Deviations from the reviewed envelope, stated explicitly

1. **No generation step.** The reviewed run rendered the reference tree inside the
   unit; this one cannot and did not. The tree is a frozen input, verified by the 7
   pinned digests (exit 94 on any mismatch, never repaired).
2. **No writable host path.** The reviewed run re-bound `templates/` read-write. This
   run binds nothing: `--ro-bind / /` plus `--tmpfs /tmp`, so the whole repository
   is read-only and `/tmp` is the only writable filesystem. No test needed a
   writable repo path; every test that writes uses `mkdtemp` under `tmpdir()`.
3. **Payload order** is gate → 13-file existence → frozen-reference digest → suite,
   with generation removed and the reference check added in its place.
4. **`/bin/bash` is named explicitly** as the unit's `ExecStart`, so the `0600`
   scripts are never depended on as `exec`-able files.
5. The 7-file reference tree and all 13 test files are **frozen inputs owned by
   other workers** (the two admitted-template assertion fixes and the `cli.test.js`
   `generatedTest()` change). Nothing in them was edited here.

## 10. Source integrity

`11-hashes-before.txt` vs `50-hashes-after.txt`, compared as a path→digest map:
**31 of 32 paths present in both files are digest-identical; 0 changed.** The 32nd
path is `experiments/.../tests/layout.test.mjs`, recorded before with an absolute
path and after inside the slice section with a relative path; its digest is the same
`31a66b4b677df2e5e50facb0091815c837a3fc7a918d801f1ed91e57133ba5de` on both sides and
matches the in-envelope `test.file.sha256` line. So: `src/`, `tests/`,
`package.json`, all three `templates/` trees, the whole `admitted-template` slice
(including the out-of-scope `tests/arm-contract.test.mjs`,
`38a6f13254a6922dd295cdc8f1509c52e118dbff8b07d732ba14cc824266b890`) and the
reference tree are unchanged across the attempt. No writable path existed inside the
sandbox, so no source *could* have been written by the suite; this comparison is the
independent check of that.

The 13 in-envelope digests (`test.file.sha256=...`) are printed for all 13 files in
`30-unit-stdout.log`, so the exact bytes executed are pinned by the run itself.

Post state: unit collected (`LoadState=not-found`, `Result=success`, cgroup dir gone),
no `bwrap`/`node --test`/wrapper leftovers, production listener on `:3080` unchanged
(`LISTEN 127.0.0.1:3080`, pid 359980), only the pre-existing failed `rc-local.service`
remains failed, host `MemAvailable` 1413788 kB after. One line in the leftover-process
scan matched the orchestrator's own parent shell (`bash -c ... 10-orchestrator.sh`) —
that is the harness command itself, not a stray process. No competing workload was
present at pre-registration and nothing was stopped to make room.

## 11. Evidence index

Raw evidence: `projects/dsh-plugin-kit/docs/testing/runs/20261103T141847Z-admitted-template-recheck/`

| file | sha256 | content |
|---|---|---|
| `00-preflight.txt` | `262da73d947cc7d385cfb39b4df42bd3412e2df597eaa9c15ecf8cb55c62ce55` | host survey, before the attempt (context only, not the gate); `competing workers: NONE` |
| `10-orchestrator.sh` | `15ce28dda6c6bf2fb416eb475c05d0314f851eb627b13e1876a51a5bc2debb80` | host-side supervisor as executed (mode 0600) |
| `11-hashes-before.txt` | `30176c7ce34b5fe7e71b67997700f092153d167f2ed9488232e355ca03622b9e` | source digests before, incl. the 13 files individually |
| `12-invocation.txt` | `1889b7192d8d427bf118f208bd3cebd1f24a5703b31131edb661756f59737a98` | the single `systemd-run` argv, element by element, plus the 13 test paths |
| `20-outer-wrapper.sh` | `3d6abf56d51c200356f31c6c3d3a67a997fa2d12452f619bfc270bf031d89cd2` | the unit's `ExecStart`: manager + cgroup readback, then bwrap (mode 0600) |
| `21-envelope-runner.sh` | `415a74d2288ba8923fd5bda9b76364b013fe1d8b10cd576d07ba8002d7aa7c65` | the in-sandbox payload: limits, shape, gate, 13 files, frozen reference, one test run (mode 0600) |
| `30-unit-stdout.log` | `e07a5779bd4998fd7aa545eae0f076701319fb7385b73f93d19a7b75faa4e76e` | verbatim stdout: `OUTER` readbacks, all `ENVELOPE` lines, full test output, peaks |
| `31-unit-stderr.log` | `e3b0c442…b855` (empty) | verbatim stderr — **0 bytes** |
| `40-launch-exit-status.txt` | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` | `0` |
| `50-hashes-after.txt` | `12d6c5fed88537facd70ac5568c504dd988f9f994fb122330a963a2180f44ac7` | source digests after, reference-tree digests, counts |
| `60-journal.txt` | `e236064e7ad3d93c9eb571f8138e861fed48393333c1a1ff4b1351c1d006e5d6` | journal for `recheck-1793715527.service` |
| `70-post-attempt.txt` | `caff84b9f40cb8f14314285922987020372f115fe54ffe4d1ae2052cef74903e` | post state: unit collected, no leftovers, `:3080` unchanged, meminfo |

Unit `recheck-1793715527.service` was `--collect`ed and is gone from the manager.
