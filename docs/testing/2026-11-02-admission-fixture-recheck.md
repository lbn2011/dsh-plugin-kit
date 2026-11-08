# Admission slice — source/contract unit recheck (2026-11-02)

**Status: PASSED — 91 of 91 tests passed, 0 failed, inside a correctly applied
envelope whose Type= and RuntimeMaxUSec= were read back from the manager.**

One launch, one test attempt, no retry, no fix, no source edit. This run is the
separately authorized recheck that followed the three confirmed matcher fixes in
`envelope-contract.test.mjs` and `lifecycle-contract.test.mjs` (§6). Nothing was
changed to make it pass: the only edits in the slice are the two test files whose
digests differ from the previous run, and both were written before this attempt.

## 1. What this record is, and what it is not

ONE execution of exactly the five source/contract test files of the admission slice,
inside the mandatory resource envelope:

- `experiments/dsh-live-lab/admission/tests/aggregate-verdict.test.mjs`
- `experiments/dsh-live-lab/admission/tests/record-validator.test.mjs`
- `experiments/dsh-live-lab/admission/tests/envelope-contract.test.mjs`
- `experiments/dsh-live-lab/admission/tests/layout.test.mjs`
- `experiments/dsh-live-lab/admission/tests/lifecycle-contract.test.mjs`

It is **not Loader evidence.** These five files read sources as text, exercise pure
modules, and in `layout.test.mjs` create real temporary directories under a tmpfs.
They start no Loader, no Cordis fiber, no arm, no host, no plugin runtime. Several
tests assert *source shape* — that `admit` is awaited, that the teardown gate opens
before `disposeHost`, that the payload refuses before `prepare` — and a source-shape
assertion cannot execute the pending-fiber settlement path. It says the files still
contain the construct the arm depends on; it says nothing about that path running.

The slice's arm status therefore stays **NOT RUN**, and this record does not entitle
anyone to change it. No install, no build, no `npm`, no network, no source edit, no
delegation, no retry.

## 2. Run identity

| field | value |
|---|---|
| attempt (UTC) | 2026-11-02T14:47:50Z (local 22:47:50 +08:00) |
| repo HEAD | `effb9581687f995841d872304e03627473039957` (2026-10-10, "Merge pull request #22 …") |
| slice tree state | untracked (`experiments/` is untracked in this checkout); identity of record is the **hashes** in §5, not a commit |
| unit name | `fixture-recheck-313148.service` (transient, `--collect`ed; not-found in the manager afterwards) |
| raw report dir | `projects/dsh-plugin-kit/docs/testing/runs/20261102T144639Z-fixture-recheck/` |
| node | `/www/server/nodejs/v24.21.0/bin/node`, v24.21.0 read from the install path — **never probed**, no `node --version` inside or outside the envelope |
| launcher exit | `0` (`40-launch-exit-status.txt`) |
| unit lifetime | started 22:47:50 → `Deactivated successfully` 22:47:51 (≈ 1.0 s); `Result=success` |
| scope | the five files above. No arm, no Loader, no kit suite, no install, no build |

Raw command (`12-invocation.txt`, one element per line):

```
systemd-run --quiet --wait --pipe --collect --unit fixture-recheck-313148 \
  --service-type=exec \
  --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=CPUQuota=50% --property=RuntimeMaxSec=120 \
  --working-directory=/root/dsh-ecosystem-spec/experiments/dsh-live-lab/admission \
  -- /bin/bash <run dir>/20-outer-wrapper.sh fixture-recheck-313148 <run dir>
```

The unit's `ExecStart` is the **host-side wrapper**, not bwrap. That is a deliberate
change of shape from the previous run and it exists for one reason: the manager's own
`Type=` and `RuntimeMaxUSec=` can only be read from a process that is still in the
host mount namespace. The wrapper reads them, then enters bwrap, then reads the
cgroup peaks after the payload exits but before the unit does. Inside, the payload ran:

```
/www/server/nodejs/v24.21.0/bin/node --max-old-space-size=384 --test --test-concurrency=1 \
  tests/aggregate-verdict.test.mjs tests/record-validator.test.mjs \
  tests/envelope-contract.test.mjs tests/layout.test.mjs \
  tests/lifecycle-contract.test.mjs
```

The five paths are **named literally**, not globbed: a sixth file appearing in
`tests/` could not silently join this attempt.

## 3. Envelope actually applied — readback, and where each was read

### 3.1 Manager readback of the OUTER unit (before bwrap)

`systemctl show` executed by the unit's own ExecStart, in the host namespace, exit 0:

| property | readback |
|---|---|
| `Type` | **`exec`** |
| `RuntimeMaxUSec` | **`2min`** (= 120 s) |
| `TimeoutStartUSec` | `1min 30s` (systemd default, not requested) |
| `MemoryMax` | `805306368` |
| `MemorySwapMax` | `0` |
| `TasksMax` | `32` |
| `CPUQuotaPerSecUSec` | `500ms` |
| `ActiveState` / `SubState` | `active` / `running` |
| `InvocationID` | `f15e8ae6936e4d60b5f7014d391b780c` |

This closes the gap the previous record had to leave open: `Type=exec` and the 120 s
runtime cap are now **manager readbacks**, not launch-configuration claims. The read
happened before any namespace was entered — the correct place, since the sandboxed
payload has no route to the system scope bus.

### 3.2 Kernel readback of the cgroup, from both sides

| limit | requested | read inside the sandbox | read outside (wrapper) |
|---|---|---|---|
| `memory.max` | 768M | `805306368` (= 768 MiB exactly) | `805306368` |
| `memory.swap.max` | 0 | `0` | `0` |
| `pids.max` | 32 | `32` | `32` |
| `cpu.max` | 50% | `50000 100000` | `50000 100000` |
| `RuntimeMaxSec` | 120 | — (not a cgroup file) | `2min` via §3.1 |

Both sides resolved the same cgroup path, `/system.slice/fixture-recheck-313148.service`,
so the "inside" numbers are this unit's and not a parent's.

### 3.3 Sandbox shape, observed from inside

- namespaces all distinct from the host pid namespace `4026531836`:
  `pid:[4026532322]`, `net:[4026532323]`, `ipc:[4026532321]`, `uts:[4026532320]`,
  `mnt:[4026532319]`;
- `/` mounted **read-only** (`ro,nosuid,nodev,relatime,errors=remount-ro ext4 /dev/sdb1`);
- a fresh writable tmpfs on `/tmp` (stacked over the host's read-only tmpfs), and
  `mktemp -d /tmp/envprobe.XXXXXX` succeeded (`PROBE_OK`) — so `layout.test.mjs`'s
  throwaway directories had somewhere to live with no writable path on the host
  filesystem;
- environment seen by the tests was exactly `HOME=/tmp`,
  `PATH=/usr/local/bin:/usr/bin:/bin` plus bash's own `PWD`/`OLDPWD`/`SHLVL`/`_`;
  the parent's environment did not leak;
- `memory.oom.group 0`.

PID 1 inside the private namespace was `bwrap`. That observation is *not* the basis for
the Type claim in §3.1 — the manager readback is.

## 4. Availability gate — one sample, inside the unit

| field | value |
|---|---|
| threshold | 1228800 kB = **1200 MiB** |
| sample | **1781104 kB = 1739.4 MiB** (`MemAvailable`, read once) |
| reads / polls | `reads=1 polls=0` |
| verdict | `ENVELOPE GATE=PASS` |

One `awk` read of `/proc/meminfo`, no `sleep`, no loop, no second opinion. The host
survey in `00-preflight.txt` (1768336 kB at 22:47:25) is labelled there as context
only; the gate that decided this attempt is the in-unit sample above.

## 5. Source hashes — identical before and after

`11-hashes-before.txt` and `50-hashes-after.txt` cover 24 source digests: the five test
files, every module they import (`lib/expectations.mjs`, `lib/record.mjs`,
`lib/layout.mjs`, `validate-records.mjs`), `arm.mjs`, `prepare.mjs`, `payload.sh`,
`run-isolated.sh`, `README.md` and the ten `fixtures/*`. `diff` between the two files
is **header comment only**; all 24 digests are identical, and the slice's directory
mtimes were all older than the 22:47:50 attempt afterwards.

Against the previous run's `11-hashes-before.txt`, 22 of 24 digests are identical.
Exactly two differ — the two files that received the three matcher fixes:

| file | lines | sha256 |
|---|---|---|
| `aggregate-verdict.test.mjs` | 427 | `437bb5ae5e27ba34e11ae04616da837c33e44076abb0051a843cafcecce09ff1` (unchanged) |
| `record-validator.test.mjs` | 310 | `b2a6962f5f2d6e90bbeeb56467f3de28e161dbdc2221a0d7ee9d0ac004f25b9a` (unchanged) |
| `envelope-contract.test.mjs` | 357 | `716393a7c9c08ba4937faa34d9213b504ea70de3109f9186929360a42799209b` (was `3863fd68…`, 323 lines) |
| `layout.test.mjs` | 237 | `917d066cadf3b3a9bfd7bd535030ac009df38fefd1399466204bbe69c458f5ed` (unchanged) |
| `lifecycle-contract.test.mjs` | 363 | `736ccadedf44fde9bf04b902e996648872cca26f618e80db3542b12028be96c8` (was `2c3a5786…`, 341 lines) |

No module, fixture, launcher or payload moved. The failure of 2026-11-02T14:39:40Z
(88/91, 3 failed) is historical and unaffected by this run.

## 6. The three matcher fixes, and what made each one a fix

All three were literal/shape assertions that misfired on correct code. Each was
repaired by making the matcher see code as code — and each now carries a negative
control, so a matcher that quietly stopped matching anything would fail rather than
pass.

**6.1 `envelope-contract` — "nothing is written before the root and the envelope have
been checked".** Was: `count(launcher, /\bmkdir -p\b/g) === 0` over the whole launcher
file, which counted a *comment* that forbids `mkdir -p`. Now the same matcher runs over
`executableLines(launcher)` (comments stripped), and a negative control asserts the
stripper does not blind the matcher:
`count(executableLines('if true; then\n  mkdir -p …\nfi\n'), …) === 1`.
The property itself still holds: the guarded, non-recursive
`mkdir "$RUNTIME_ROOT" || refuse 3 "RUNTIME_ROOT_CREATE_FAILED"` is asserted present
once and bare `mkdir` absent, and all nineteen refusal codes are still ordered before
it.

**6.2 `envelope-contract` — "the payload stops where it fails".** Was: the stop block
sliced from the refusal *message* (`heap precondition rc=…`), which in `payload.sh`
sits after the three `export …="$NOT_RUN"` lines, so the window was empty of them.
Now: `heapStop = at(payload, 'if [ "$PROBE_RC" -ne 0 ]; then', …)` — the guard itself,
not the sentence it prints. The block now contains `exit 6`, all three not-run exports,
and the "stopping before prepare and arm" text, and still must not reach the `prepare`
invocation.

**6.3 `lifecycle-contract` — "the arm computes its own coverage from the list MINUS the
sentinel".** Was: `arm.includes('EXPECTED_IDS.filter(id => !present.has(id))') === false`,
a substring that is contained in the correct `ARM_EXPECTED_IDS.filter(...)`. Now: a
whole-token matcher `/(?<![\w$])EXPECTED_IDS\s*\.\s*filter\s*\(/`, with three negative
controls — it must not flag `ARM_EXPECTED_IDS.filter(...)`, must flag
`EXPECTED_IDS.filter(...)`, and must not flag `EXPECTED_IDS.length`.

These are test-instrument repairs, not behaviour changes. Nothing in `arm.mjs`,
`payload.sh`, `run-isolated.sh` or any module was touched to obtain the green result —
§5 is the check, and it is byte-identical.

## 7. Result — exact counts

```
ℹ tests 91   ℹ suites 0   ℹ pass 91   ℹ fail 0
ℹ cancelled 0   ℹ skipped 0   ℹ todo 0
ℹ duration_ms 825.541117
ENVELOPE TESTS_EXIT=0
```

`30-unit-stdout.log` contains **91** `✔` lines and **0** `✖`/`not ok` lines. The count
is reported, not assumed: 87 `test(` declarations across the five files, of which
`lifecycle-contract.test.mjs` has one inside a five-role loop, plus this run's
negative-control assertions which add assertions rather than tests — the executed
total stayed 91 and is quoted from node's own summary. The reporter prints no per-file
split for a multi-file run, so the derived expectation is:

| file | executed | pass | fail |
|---|---|---|---|
| `aggregate-verdict.test.mjs` | 22 | 22 | 0 |
| `record-validator.test.mjs` | 21 | 21 | 0 |
| `envelope-contract.test.mjs` | 16 | 16 | **0** (was 14/16) |
| `layout.test.mjs` | 12 | 12 | 0 |
| `lifecycle-contract.test.mjs` | 20 (15 + the 5-role loop) | 20 | **0** (was 19/20) |

The three previously failing tests now pass by name:
`nothing is written before the root and the envelope have been checked`,
`the payload stops where it fails, and the validator stays the authority`,
`the arm computes its own coverage from the list MINUS the sentinel`.

Also green, as before: the null/non-object JSON guard (`parseRecordLine refuses a bare
null, a number, a string and an empty file`; `The final record check explicitly rejects
null and non-object JSON`), the single-verdict wiring
(`a settled passing run writes a record the launcher greps can accept`;
`the persisted status, the printed status and the exit code cannot disagree`), and the
fixed list's 57 ids (`the fixed expectation list is stable, unique and non-empty`).

## 8. Consumption — read while the unit was still alive

`--collect` deletes the cgroup at exit, so these were read twice: inside the payload
after node exited, and outside by the wrapper after bwrap returned, both before the
unit's own exit.

| counter | value | against the bound |
|---|---|---|
| `memory.peak` | **35 479 552 B = 33.8 MiB** | 4.4 % of the 768 MiB max |
| `memory.swap.peak` | **0** | swap stayed disabled |
| `pids.peak` | **17** | 53 % of `pids.max` = 32 |
| `memory.current` at exit | 2 101 248 B = 2.0 MiB | — |
| `cpu.stat usage_usec` | 538 697 in-sandbox / 546 617 whole-unit (0.55 s CPU) | — |
| `nr_throttled` / `nr_periods` | 10 / 11 (`throttled_usec` 633 627) | the 50 % quota held the run |
| `memory.events` | `oom 0 oom_kill 0 oom_group_kill 0`, `max 0` | nothing killed for memory |
| `memory.pressure` | `some` and `full` all `avg=0.00 total=0` | no memory stall |

The CPU quota was the only bound that bit — during start-up, not during a failure.

## 9. Deviations from the instruction, all of them

1. **One aborted invocation of the orchestrator, before any unit existed.** The first
   `./10-orchestrator.sh` exited `126` (`Permission denied`): the file was mode `600`.
   Verified afterwards that it produced nothing — no unit in the manager, no journal
   entry, no process, no log file, no hash file. One `chmod 700` on the three scripts,
   then the single launch. No envelope was ever established by the aborted call, so the
   test attempt count is **one**; it is listed anyway because it happened.
2. **`Type=exec` and `RuntimeMaxUSec` are now read from the manager, and that required
   the unit's `ExecStart` to be a host-side wrapper rather than bwrap.** The wrapper
   reads, then enters bwrap, then reads peaks, then exits with the payload's status. The
   sandbox shape is unchanged.
3. **`timeout 10` around `systemctl show`.** A bound on one command so a stuck bus
   query can never be what keeps the unit alive. Not a poll, not a retry; it did not
   fire (`show.rc=0`).
4. **`--clearenv` on bwrap**, as in the previous run: it only *removes* inherited
   environment before `env -i` re-adds two variables. It widens nothing.
5. **`RuntimeMaxSec=120` was again not exercised**: the unit finished in ≈1.0 s. Its
   value is now read back from the manager (§3.1), so what is proven is that it was
   *set* to 120 s, not that it fires.
6. **`70-post-attempt.txt` lists one "leftover process".** It is the supervising shell
   command line itself, matched because its text contains the wrapper's path. No
   process from the unit survived; the unit was `Deactivated successfully` and its
   cgroup directory is gone.
7. **No node process ran outside the envelope, and no `node --version` ran anywhere.**
   The version in §2 is read from the install path.
8. No retry, no re-run, no source edit, no install/build, no delegation, no change to
   production. `127.0.0.1:3080` was listening before and after with the same pid
   (303282); no unit was stopped; the only failed unit remains the pre-existing
   `rc-local.service`.

## 10. Raw evidence

All in `projects/dsh-plugin-kit/docs/testing/runs/20261102T144639Z-fixture-recheck/`:

| file | contents | sha256 (first 12) |
|---|---|---|
| `00-preflight.txt` | host survey, explicitly not the gate | `6f75dfc1f88a` |
| `10-orchestrator.sh` | the orchestrator, as executed | `8e2b9a01f1dd` |
| `11-hashes-before.txt` | 24 source digests + line counts + run-script digests, before | `0239a5eb998f` |
| `12-invocation.txt` | the single command, one element per line | `063c48da67e8` |
| `20-outer-wrapper.sh` | the host-side half: manager readback, cgroup limits, peaks | `062b649a4dc9` |
| `21-envelope-runner.sh` | the in-sandbox half: limits, gate, tests, accounting | `a34588f31b7f` |
| `30-unit-stdout.log` | the whole attempt: OUTER readback, limits, namespaces, gate, all 91 test lines, peaks | `ad0417017e5c` |
| `31-unit-stderr.log` | empty (0 bytes) | `e3b0c44298fc` |
| `40-launch-exit-status.txt` | `0` | `9a271f2a916b` |
| `50-hashes-after.txt` | the same 24 digests, after — identical | `7e478db95f71` |
| `60-journal.txt` | `Starting` → `Started` → `Deactivated successfully`, no failure | `a211fdf5bb52` |
| `70-post-attempt.txt` | manager state, failed units, 3080 listener, leftovers, meminfo, file list | `5c1371ffc695` |

## 11. What a reader may and may not conclude

**May:** the envelope was really applied and, unlike the previous run, its `Type=exec`
and 120 s runtime cap were **read back from systemd**; the gate passed on one in-unit
sample with no polling; no source in the slice was touched before or after; and all 91
source/contract assertions — including the three that failed last time and every one
covering the Lead's corrections — hold.

**May not:** that the admission slice works. These tests read text and pure modules.
They do not start a Loader, an arm or a fiber, and a source-shape assertion that
`admit` is awaited does not execute the pending-fiber settlement path. No real
admission occurred here. The arm's status stays **NOT RUN**, and the earlier
91/88/3 result of 2026-11-02T14:39:40Z stands as the record of that day.
