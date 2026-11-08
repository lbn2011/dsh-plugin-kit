# Admitted-template reference generation + kit suite — ONE bounded unit (2026-11-03)

**Status: EXECUTED, ONCE — generation PASSED, suite FAILED (200 tests, 197 pass,
3 fail, 0 skipped). Launcher exit 1. No Loader evidence. No retry was made.**

§1–§5 were written *before* the attempt, as required: they state exactly what would
be executed, exactly once, and what would not be. §6–§7 were then filled in from the
single launch's own artifacts. Nothing here comes from a retry — **one attempt, no
fix, no rerun** — and none of the three failures was investigated by executing
anything again.

## 1. Authority and role of this record

This is an **independent kit regression executed by a sole worker**. The real Loader
arm worker (`worker11559`) is `CODEONLY` and is not touched here.

- No Loader, no Cordis fiber, no arm, no host, no plugin runtime.
- No install, no build, no `npm`, no network, no production modification.
- No edit of `runtime/`, no edit of `tests/`, no edit of any other report.
- No delegation.
- The **only** intended source-side change is the new reference tree
  `projects/dsh-plugin-kit/templates/host-tool-admitted/` (7 generated files).

Tests that use mocks are reported as *kit + mock host*, never as Loader evidence.
Optional or cross-repo tests that early-return are reported as **skipped**, with the
reason the suite itself printed.

## 2. Run identity

| field | value |
|---|---|
| prepared (local) | 2026-11-03T21:57+08:00 |
| repo HEAD | `effb9581687f995841d872304e03627473039957` |
| working tree | `experiments/` and the new run directory are untracked in this checkout |
| node | `/www/server/nodejs/v24.21.0/bin/node` — version read from the install path, **not probed** with `--version` |
| bwrap | `/usr/bin/bwrap` 0.12.0 |
| systemd | 257 (257.13-1~deb13u1), pid1 systemd, `degraded` (stale `rc-local.service`, pre-existing) |
| preflight MemAvailable | 1461672 kB (1427 MiB) — *survey only, NOT the gate* |
| target state | `projects/dsh-plugin-kit/templates/host-tool-admitted` **absent** at pre-registration |
| competing workers | NONE (no `node --test`, no `bwrap`, no `systemd-run`) |
| stale transient units | NONE |

The availability gate is **not** evaluated here. It is evaluated exactly once,
inside the unit, by the payload, with a single `MemAvailable` sample and no polling.

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

`ExecStart` is the **host-side wrapper**, not bwrap, because the manager's own
`Type=` and `RuntimeMaxUSec=` can only be read from a process still in the host
mount namespace. The wrapper reads them, then enters bwrap, then reads the cgroup
peak counters after the payload exits but before the unit exits. This is the same
shape as the reviewed `20261102T144639Z-fixture-recheck` runner, extended so that
one exact directory is writable.

### 3.1 Sandbox shape

```
bwrap --ro-bind / / --proc /proc --dev /dev \
      --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent \
      --clearenv --tmpfs /tmp \
      --bind /root/dsh-ecosystem-spec/projects/dsh-plugin-kit/templates \
             /root/dsh-ecosystem-spec/projects/dsh-plugin-kit/templates \
      -- /usr/bin/env -i PATH=... HOME=/tmp /bin/bash <payload>
```

- `/` read-only; `--tmpfs /tmp`; namespaces pid/net/ipc/uts private.
- The **only** host-writable path is the kit's existing `templates/` directory,
  re-bound read-write over the read-only view. It exists and is not created by the
  sandbox. Everything else in the repository — `src/`, `tests/`, `experiments/`,
  `docs/` — stays read-only, so a test that tried to write a source would fail
  rather than corrupt the tree.
- All logging is done by the outer supervisor on the host, through
  `systemd-run --pipe`; the sandbox writes no log file.

### 3.2 Payload order (strict, no branch may be skipped silently)

1. read the effective cgroup limits from the payload's own cgroup;
2. **one** `MemAvailable` sample; `< 1200 MiB` ⇒ `GATE=REFUSED`, exit 91, no test runs;
3. verify the 13 literal test files exist — any missing ⇒ stop and report, exit 93, no generation, no suite;
4. refuse if `templates/host-tool-admitted` already exists, exit 92 — **never delete, never overwrite**;
5. `node --max-old-space-size=384 experiments/dsh-live-lab/admitted-template/render-reference.mjs`;
   non-zero ⇒ generation failed, exit that code, **the suite does not run**;
6. hash and account the generated tree (7 files);
7. `node --max-old-space-size=384 --test --test-concurrency=1 <13 literal files>`;
8. read peak/accounting counters from inside, before the unit can be collected.

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

Named literally so that a file appearing in either `tests/` directory cannot
silently join this attempt. All 13 were confirmed present at pre-registration.

### 4.1 Deliberately NOT RUN

- `experiments/dsh-live-lab/admitted-template/tests/` — only `layout.test.mjs` is
  in scope; nothing else in that directory was added.
- the generated project's own `test/plugin.test.js` (the 7th generated file): it
  imports `schemastery`, `dsh-tools` and `dsh-plugin-kit`, and the kit has **no
  `node_modules`**. Without an install it cannot be executed as its own suite.
  It is therefore **NOT RUN as a suite** here; only its text is read (step 6 and
  §7.4). Note that `tests/cli.test.js` separately builds a *throwaway stub*
  `node_modules` in a temp dir and executes the generated static test against
  stubs — that is a mock-host check inside the kit suite, not an execution of the
  generated project against real dependencies.
- anything Loader, arm, or host related.

## 5. What would make this record invalid

- more than one launch, a retry, or a fix applied between launch and record;
- a test file added to, or removed from, the list in §4;
- any writable path in the sandbox other than `templates/` and the tmpfs `/tmp`;
- a gate sample taken more than once, or taken outside the unit;
- a claim that a skipped test passed.

## 6. Result

One launch, one generation, one test run. **Generation passed; the suite failed
with 3 of 200 tests failing.** Nothing was fixed, nothing was retried, and the
generated tree was left exactly as the generator wrote it.

### 6.1 Envelope actually applied (readbacks, not launch claims)

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
(`/system.slice/refgen-1793714386.service`), same path on both sides:
`memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`, `memory.high=max`, `memory.oom.group=0`.

Sandbox shape, observed from inside: `pid:[4026532322]`, `net:[4026532323]`,
`ipc:[4026532321]`, `uts:[4026532320]`, `mnt:[4026532319]` — all distinct from the
host pid namespace; `/` mounted `ro`; a fresh writable tmpfs on `/tmp`
(`mktemp -d` succeeded). Writability, by `access(W_OK)` which writes nothing:

| path | writable |
|---|---|
| `projects/dsh-plugin-kit/templates/` | **YES** (the only host-writable path) |
| `projects/dsh-plugin-kit/src/` | NO |
| `projects/dsh-plugin-kit/tests/` | NO |
| `experiments/dsh-live-lab/admitted-template/` | NO |
| `docs/` | NO |
| `/tmp` | YES (tmpfs) |

Gate: **one** `MemAvailable` sample inside the unit, `1455084 kB` = **1421.0 MiB**
against the `1228800 kB` (1200 MiB) floor ⇒ `GATE=PASS`, `reads=1 polls=0`.

Peaks, read inside before the unit exited: `memory.peak=57401344` (54.7 MiB of
768 MiB), `memory.swap.peak=0`, `pids.peak=32` (the pids limit was reached, not
exceeded), CPU `usage_usec=3241855`, `nr_throttled=64` of `nr_periods=69`,
`throttled_usec=4018327`, `oom_kill=0`. Unit lifetime ≈ 26 s of the 120 s cap.

### 6.2 Reference generation

`node --max-old-space-size=384 experiments/dsh-live-lab/admitted-template/render-reference.mjs`
→ **exit 0**, `{"ok":true,...,"targetCreated":true,"issues":[]}`, written **7 files**,
23785 bytes, 2 directories. The target was absent before the attempt and was never
deleted or overwritten afterwards.

| file | bytes | lines | sha256 |
|---|---|---|---|
| `README.md` | 7670 | 161 | `fd7c839ed6d119aa58167f402f67cd70f4a03801bcffd3243776d2c476ae65b4` |
| `cordis.patch.yml` | 487 | 11 | `79479b0e6959305e5c3188e7596cb7b98332f2376c6522bc4c9a7c4ee9b736e7` |
| `declaration.json` | 339 | 21 | `9f504567788d90866678e11117ecbe10ab01758278fe34fcfa61c5c2d40db988` |
| `index.js` | 5496 | 125 | `9e2bb788bb3d7a2a533e406b009b62c888dfce7959c277f9660c11a4b65f175f` |
| `jsconfig.json` | 178 | 12 | `7885998456d4034e5e72324027fc1ba9727e9369d28348253c00e69f8df85c6e` |
| `package.json` | 840 | 32 | `bf93542fcb7edd481e1326a78041a6bbd1398846ccac7274626da2beca95428c` |
| `test/plugin.test.js` | 8775 | 173 | `3e4ae49a967285d4445fe4841bad7ba5861b751665dac81b80fa00df322c2811` |

Host-side readback after the attempt reproduced all seven digests byte for byte.

### 6.3 The suite

`node --max-old-space-size=384 --test --test-concurrency=1` over the 13 literal
files of §4, once, `env -i PATH=... HOME=/tmp`:

```
ℹ tests 200   ℹ pass 197   ℹ fail 3   ℹ skipped 0   ℹ todo 0   ℹ cancelled 0
ℹ duration_ms 25805.411504          ENVELOPE TESTS_EXIT=1
```

**0 tests were skipped**, so there is no early-return or cross-repo test to report
as skipped in this run. (The previous 2026-11-02 baseline of the same suite was 152
tests / 152 pass / 0 fail, but that was 10 files at an older repo state; the numbers
are not comparable.)

#### Failure 1 — `tests/admitted-template.test.js:252`

`the admitted template is a third implemented catalog entry and renders the same seven files`

`assert.deepEqual([...files.keys()], RENDERED)` compares the renderer's **insertion
order** (`package.json, cordis.patch.yml, index.js, declaration.json, jsconfig.json,
README.md, test/plugin.test.js`) against the test's **alphabetical** `RENDERED`
constant. The very next line re-compares with `.sort()` and would pass. This is an
order-sensitive assertion over an in-memory render — it reads no disk, so the
generated tree cannot influence it. It was already failing at this repo state and is
**not an effect of the attempt**.

#### Failure 2 — `tests/admitted-template.test.js:599`

`the checked-in admitted reference matches the renderer byte for byte`

This test **did not skip**: it skipped only while the directory was absent, and the
generation put it there, so the byte comparison ran for the first time.
`ENOENT: .../templates/host-tool-admitted/generated-readme.md`. The renderer writes
its rendering of the README to `README.md`; the review copy the test expects is the
`host-tool-managed` layout — a hand-written `README.md` **plus**
`generated-readme.md`. Generating alone therefore cannot satisfy this check: the
produced tree is the renderer's output, not a review copy. Reported, not repaired.

#### Failure 3 — `tests/cli.test.js:359`

`the generated project test passes once the shared host packages resolve`
(`20121.932 ms`)

The helper `generatedTest()` runs `node --test` in a throwaway temp project with a
stub `node_modules` under its own `timeout: 20_000`, and the child did not finish
inside that bound, so `generated.ok` was `false`. 20122 ms is the helper's own
timeout, and the unit was throttled (`nr_throttled=64`/`69`, `throttled_usec≈4.0 s`
of `usage_usec≈3.24 s` under `CPUQuota=50%`). This record therefore states the
observed failure and its bound, **not** a diagnosis: whether this test passes
without the CPU quota is not established here, and no rerun was made to find out.

### 6.4 What this record does and does not say

- It says the generator, run once in this envelope, produced seven files whose
  digests are pinned above, and that 197 of 200 tests in the 13 named files passed.
- It says the admitted **review copy** is still not in the shape
  `admitted-template.test.js` requires, and that one admitted-test assertion is
  order-sensitive in a way that fails today.
- It says **nothing** about a Loader, an arm, a host, or a plugin runtime. No
  Loader was started, `worker11559` stays `CODEONLY`, and no mock-host pass here is
  Loader evidence. The generated `test/plugin.test.js` is **NOT RUN** as a suite
  (§4.1); only its text was read.

### 6.5 Source integrity

`11-hashes-before.txt` vs `50-hashes-after.txt`: every file of `src/`, `tests/`,
`package.json`, the existing `host-tool/` and `host-tool-managed/` trees and the
`admitted-template` slice is **digest-identical** before and after. The only new
path is the 7-file reference tree. One observation outside this attempt: the slice
gained `tests/arm-contract.test.mjs` (14921 B, mtime 22:00:46 +08:00) from another
process during the run window; it is **not** one of the 13 named files and was not
executed by this attempt.

## 7. Evidence index

Raw evidence: `projects/dsh-plugin-kit/docs/testing/runs/20261103T135946Z-admitted-template-unit/`

| file | content |
|---|---|
| `00-preflight.txt` | host survey, before the attempt (context only, not the gate) |
| `10-orchestrator.sh` | the host-side supervisor, as executed (mode 0600) |
| `11-hashes-before.txt` | source digests before the attempt |
| `12-invocation.txt` | the single `systemd-run` argv, element by element, plus the 13 test paths |
| `20-outer-wrapper.sh` | the unit's `ExecStart`: manager + cgroup readback, then bwrap (mode 0600) |
| `21-envelope-runner.sh` | the in-sandbox payload: limits, gate, existence check, generation, hashes, one test run (mode 0600) |
| `30-unit-stdout.log` | verbatim stdout: `OUTER` readbacks, all `ENVELOPE` lines, full test output, peaks |
| `31-unit-stderr.log` | verbatim stderr — **empty** (0 bytes) |
| `40-launch-exit-status.txt` | `1` |
| `50-hashes-after.txt` | source digests after, generated-tree digests, counts |
| `60-journal.txt` | journal for `refgen-1793714386.service` |
| `70-post-attempt.txt` | post state: unit collected, no leftovers, `:3080` unchanged, meminfo |

Unit `refgen-1793714386.service` was `--collect`ed and is gone from the manager. The
journal records the outcome verbatim — no ambiguity is needed:
`Main process exited, code=exited, status=1/FAILURE`,
`Failed with result 'exit-code'`, `Consumed 3.251s CPU time, 54.7M memory peak`,
`Deactivated successfully`. So the wrapper's `exit 1` (the payload's status) is what
systemd saw, and 3.251 s CPU / 54.7 MiB against the 120 s, 768 MiB and 50 % caps
shows the unit ended by its own decision, not by any limit. No leftover `node`,
`bwrap` or wrapper process; the production listener on `:3080` was unchanged.
