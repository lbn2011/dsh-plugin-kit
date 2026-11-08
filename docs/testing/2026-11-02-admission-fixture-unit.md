# Admission slice — source/contract unit run (2026-11-02)

**Status: FAILED — 88 of 91 tests passed, 3 failed, inside a correctly applied envelope.**
One launch, one attempt, no retry, no fix. The three failures are in the TESTS'
own literal assertions; the modules they are meant to protect behaved as asserted
everywhere else (see §6). Nothing was changed to make them pass.

## 1. What this record is, and what it is not

This is the result of ONE execution of exactly the five source/contract test files of
the admission slice, inside the mandatory resource envelope:

- `experiments/dsh-live-lab/admission/tests/aggregate-verdict.test.mjs`
- `experiments/dsh-live-lab/admission/tests/record-validator.test.mjs`
- `experiments/dsh-live-lab/admission/tests/envelope-contract.test.mjs`
- `experiments/dsh-live-lab/admission/tests/layout.test.mjs`
- `experiments/dsh-live-lab/admission/tests/lifecycle-contract.test.mjs`

It is **not Loader evidence.** These files read sources as text, exercise pure modules
and, in `layout.test.mjs`, real temporary directories under a tmpfs. They start no
Loader, no Cordis fiber, no arm and no host. A green result here would say the shape
the arm depends on still holds in the files; it would say nothing about a real
admission. The slice's `Status: NOT RUN` claim for the arm is untouched by this
record, and this run does not entitle anyone to change it.

No install, no build, no `npm`, no network, no source edit, no delegation. The
attempt was launched once. The three failures were **not** re-run.

## 2. Run identity

| field | value |
|---|---|
| attempt (UTC) | 2026-11-02T14:39:40Z (local 22:39:40 +08:00) |
| repo HEAD | `effb9581687f995841d872304e03627473039957` (2026-10-10, "Merge pull request #22 …") |
| slice tree state | untracked (`experiments/` is untracked in this checkout); identity of record is the **hashes** in §5, not a commit |
| unit name | `fixture-unit-1793630380.service` (transient, `--collect`ed; gone from the manager afterwards) |
| raw report dir | `projects/dsh-plugin-kit/docs/testing/runs/20261102T143940Z-fixture-unit/` |
| node | `/www/server/nodejs/v24.21.0/bin/node` (v24.21.0; not probed with `--version` inside the unit — see §8.3) |
| launcher exit | `1` (`30-launch-exit-status.txt`; journal: `Main process exited, code=exited, status=1/FAILURE`) |
| unit lifetime | started 22:39:40.748 → failed 22:39:42.002 (≈ 1.25 s) |
| scope | the five files above. No arm, no Loader, no kit suite, no install, no build |

Raw command (`12-invocation.txt` holds it shell-quoted, one element per line):

```
systemd-run --quiet --wait --pipe --collect --unit fixture-unit-1793630380 \
  --service-type=exec \
  --property=MemoryMax=768M --property=MemorySwapMax=0 \
  --property=TasksMax=32 --property=CPUQuota=50% --property=RuntimeMaxSec=120 \
  --working-directory=/root/dsh-ecosystem-spec/experiments/dsh-live-lab/admission \
  -- /usr/bin/bwrap --ro-bind / / --proc /proc --dev /dev \
       --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent \
       --clearenv --tmpfs /tmp \
       /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp \
       /bin/bash <run dir>/20-envelope-runner.sh
```

Inside, the payload ran:

```
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp \
  node --max-old-space-size=384 --test --test-concurrency=1 \
    tests/aggregate-verdict.test.mjs tests/record-validator.test.mjs \
    tests/envelope-contract.test.mjs tests/layout.test.mjs \
    tests/lifecycle-contract.test.mjs
```

The five paths are **named literally**, not globbed, so a sixth file appearing in the
directory could not silently join this attempt.

## 3. Envelope actually applied — readback from inside the unit

Read from the unit's own cgroup *before* any test ran (`20-unit-stdout.log`,
`ENVELOPE limit.*`):

| limit | requested | readback (kernel) | verdict |
|---|---|---|---|
| MemoryMax | 768M | `memory.max` = **805306368** (= 768 MiB exactly) | applied |
| MemorySwapMax | 0 | `memory.swap.max` = **0** | applied |
| TasksMax | 32 | `pids.max` = **32** | applied |
| CPUQuota | 50% | `cpu.max` = **50000 100000** (= 50% of one CPU) | applied |
| RuntimeMaxSec | 120 | accepted by the manager; unit ended at 1.25 s, so it never fired | not exercised |
| Type | exec | requested in the launch command; manager readback failed | not independently read back |

PID 1 inside the private namespace was `bwrap` (`ENVELOPE unit.pid1.comm=bwrap`),
but that observation does not establish the systemd service Type. The requested
`Type=exec` and timeout remain launch-configuration evidence, not successful manager
readbacks. The in-sandbox `systemctl show` failed with `Failed to connect to system
scope bus via local transport: No data available`; that failure is preserved without
inferring that namespaces universally make host Unix sockets unreachable.

Other observed facts, all from inside:

- namespaces all distinct from the host: `pid:[4026532322]`, `net:[4026532323]`,
  `ipc:[4026532321]`, `uts:[4026532320]`, `mnt:[4026532319]`;
- `/` mounted **read-only** (`ro,... ext4 /dev/sdb1`), `/tmp` a fresh tmpfs
  (`rw,size=2006968k`), and `mktemp -d /tmp/...` succeeded (`PROBE_OK`) — so
  `layout.test.mjs`'s throwaway directories had somewhere to live without any writable
  path on the host filesystem;
- environment seen by the tests was exactly `HOME=/tmp`, `PATH=/usr/local/bin:/usr/bin:/bin`
  plus bash's own `PWD`/`SHLVL`/`_` (the parent's environment did not leak);
- `cpu.max` was the only bound that actually bit: `nr_periods 13`, `nr_throttled 12`,
  `throttled_usec 907278`. That is the 50% quota doing its job during start-up, not a
  test failure signal.
- `memory.oom.group 0`; `memory.events` at exit: `low 0 high 0 max 0 oom 0 oom_kill 0
  oom_group_kill 0` — nothing was killed for memory.
- `memory.pressure`: `some avg10=0.00 avg60=0.00 avg300=0.00 total=0`, `full` likewise.

## 4. Availability gate — one sample, inside the unit

| field | value |
|---|---|
| threshold | 1228800 kB = **1200 MiB** |
| sample | **1520200 kB = 1484.6 MiB** (`MemAvailable`, read once) |
| verdict | `ENVELOPE GATE=PASS` |
| polling / retry | none: one read, no `sleep`, no loop |

The host survey outside the unit (1479 MiB at composition time) is context only and is
labelled as such in `00-preflight.txt`; the gate that decided this attempt is the
in-unit one above.

## 5. Source hashes — identical before and after

`11-hashes-before.txt` and `50-hashes-after.txt` cover 27 files: the five test files,
every module they import (`lib/expectations.mjs`, `lib/record.mjs`, `lib/layout.mjs`,
`validate-records.mjs`), `arm.mjs`, `prepare.mjs`, `payload.sh`, `run-isolated.sh`,
`README.md` and the eight `fixtures/*`.

`diff` between the two files is **header comment only**; every one of the 27 digests is
byte-identical. Nothing in this attempt modified a source.

The five test files, as hashed inside the unit and again outside:

| file | lines | sha256 |
|---|---|---|
| `tests/aggregate-verdict.test.mjs` | 427 | `437bb5ae5e27ba34e11ae04616da837c33e44076abb0051a843cafcecce09ff1` |
| `tests/record-validator.test.mjs` | 310 | `b2a6962f5f2d6e90bbeeb56467f3de28e161dbdc2221a0d7ee9d0ac004f25b9a` |
| `tests/envelope-contract.test.mjs` | 323 | `3863fd68c016a4fe16f11f4ba7a73417d3e4f0e15a067c25c7f5938db318e323` |
| `tests/layout.test.mjs` | 237 | `917d066cadf3b3a9bfd7bd535030ac009df38fefd1399466204bbe69c458f5ed` |
| `tests/lifecycle-contract.test.mjs` | 341 | `2c3a57863e62a37a4ce19615295e045d0d8027ed1ccb6ebeb089c913b290f375` |

## 6. Result — exact counts

```
ℹ tests 91   ℹ suites 0   ℹ pass 88   ℹ fail 3
ℹ cancelled 0   ℹ skipped 0   ℹ todo 0
ℹ duration_ms 903.936615
ENVELOPE TESTS_EXIT=1
```

87 `test(` declarations across the five files, of which `lifecycle-contract.test.mjs`
has one inside a five-role loop, so 91 tests were executed:

| file | executed | pass | fail |
|---|---|---|---|
| `aggregate-verdict.test.mjs` | 22 | 22 | 0 |
| `record-validator.test.mjs` | 21 | 21 | 0 |
| `envelope-contract.test.mjs` | 16 | 14 | **2** |
| `layout.test.mjs` | 12 | 12 | 0 |
| `lifecycle-contract.test.mjs` | 20 (16 + the 5-role loop) | 19 | **1** |

The corrections the Lead made are covered and **passed**: the null/non-object JSON
guard (`parseRecordLine refuses a bare null, a number, a string and an empty file`;
`The final record check explicitly rejects null and non-object JSON`), the single
verdict feeding `selfCheck.ok` / printed status / exit code (`a settled passing run
writes a record the launcher greps can accept`; `the persisted status, the printed
status and the exit code cannot disagree`). Separate source-shape tests check that
core admission is awaited and that gate opening precedes host disposal; they do not
execute the pending-fiber settlement path or prove its runtime behavior. The fixed
list contains 57 ids. The record test checks nonempty/unique IDs and the sentinel,
while the lifecycle test retains a lower-bound coverage check; neither establishes
real Loader behavior.

### 6.1 `envelope-contract.test.mjs:153` — "nothing is written before the root and the envelope have been checked"

```
AssertionError: no recursive create anywhere
  1 !== 0   at envelope-contract.test.mjs:181
```

The assertion is `count(launcher, /\bmkdir -p\b/g) === 0`. It fires on **a comment**:
`run-isolated.sh:36` reads

```
#   3. only then create the root — one `mkdir`, not `mkdir -p`;
```

The launcher's actual create is the guarded, non-recursive
`mkdir "$RUNTIME_ROOT" || refuse 3 "RUNTIME_ROOT_CREATE_FAILED"`, and every other
assertion in this test — all nineteen refusal codes decided before that `mkdir`, the
exclusive sentinel, the post-sentinel freshness re-scan, `shopt -s nullglob dotglob` —
passed. So the property the test exists to protect holds; its regex counts prose that
states the property.

### 6.2 `envelope-contract.test.mjs:257` — "the payload stops where it fails…"

```
AssertionError: assert.ok(stopBlock.includes('DSH_ADMISSION_PREPARE_RC="$NOT_RUN"'))
   at envelope-contract.test.mjs:270
```

`stopBlock = payload.slice(index('heap precondition rc=$PROBE_RC'), index('"$SLICE_DIR/prepare.mjs"'))`.
In `payload.sh` the refusal block is ordered:

```
103  if [ "$PROBE_RC" -ne 0 ]; then
105    export DSH_ADMISSION_PREPARE_RC="$NOT_RUN"
106    export DSH_ADMISSION_ARM_RC="$NOT_RUN"
107    export DSH_ADMISSION_VALIDATE_RC="$NOT_RUN"
108    echo "payload-refused: heap precondition rc=$PROBE_RC; stopping before prepare and arm"
109    exit 6
110  fi
```

The slice therefore starts *after* the three `export …="$NOT_RUN"` lines: it contains
`exit 6` (assertion passes) but not the exports the test looks for. The payload does
mark both skipped steps as not-run and does `exit 6`; the test's window is drawn from
the wrong end of the block.

### 6.3 `lifecycle-contract.test.mjs:226` — "the arm computes its own coverage from the list MINUS the sentinel"

```
AssertionError: the arm must not compare against the complete list, or the sentinel could never pass
   true !== false   at lifecycle-contract.test.mjs:234
```

The assertion is `arm.includes('EXPECTED_IDS.filter(id => !present.has(id))') === false`.
`arm.mjs:646` is

```
const missing = ARM_EXPECTED_IDS.filter(id => !present.has(id))
```

and `'EXPECTED_IDS.filter(id => !present.has(id))'` is a **substring of
`'ARM_EXPECTED_IDS.filter(...)'`**. The arm does use the sentinel-free list (lines
646–649, and it writes the sentinel last), which is exactly what the test wants; the
substring it forbids is also a substring of the correct code. Its sibling assertion
(`ARM_EXPECTED_IDS.filter(` present, `assert(COVERAGE_SENTINEL_ID, missing.length === 0`)
passed, as did the separate test `the sentinel is on the external list and off the
arm's own list`.

Common cause, worth one sentence: all three are **literal/shape assertions in the test
files**, not behaviour that regressed — a comment mentioning `mkdir -p`, a slice window
drawn from the wrong marker, and a substring that is contained in the very construct it
forbids. Fixing them is a test change and was deliberately **not** done in this run.

## 7. Peak consumption (read from inside the unit before it exited)

| counter | value | against the bound |
|---|---|---|
| `memory.peak` | **36 700 160 B = 35.0 MiB** | 4.6 % of the 768 MiB max |
| `memory.swap.peak` | **0** | swap stayed disabled |
| `pids.peak` | **16** | 50 % of `pids.max` = 32 |
| `cpu.stat usage_usec` | 676 892 (0.68 s CPU) | — |
| `nr_throttled` / `nr_periods` | 12 / 13 (`throttled_usec` 907 278) | the 50 % quota held the run |
| `memory.events` | `oom 0 oom_kill 0 oom_group_kill 0` | no memory kill |

systemd's own post-collect accounting in the journal: `Consumed 2.810s CPU time` was the
*previous* run; this unit's journal line records the failure and no peak, so the numbers
above come from the cgroup, read at `22:39:42` while the unit was still alive — the only
moment `memory.peak` is readable given `--collect`.

## 8. Deviations from the instruction, all of them

1. **One extra bwrap flag.** The mandated flag set was applied in full
   (`--ro-bind / /`, `--proc /proc`, `--dev /dev`, `--unshare-pid/-net/-ipc/-uts`,
   `--die-with-parent`, `--tmpfs /tmp`) plus `--clearenv`, which only *removes*
   inherited environment before `env -i` re-adds the two variables. It widens nothing.
2. **The in-sandbox `systemctl show` readback failed** (`No data available` on the
   system scope bus). It was recorded as-is rather than dropped. PID 1 being `bwrap`
   is not substitute evidence for systemd Type; Type/timeout were requested but not
   independently read back. No retry was made inside or after the unit.
3. **One node process outside the envelope.** After the attempt finished, and after the
   tests had run, the supervisor invoked `node --version` once in an ordinary shell to
   label this record. It executed no test code and touched no source. Flagged because
   the instruction restricted node to the envelope.
4. **`RuntimeMaxSec=120` was never exercised**: the unit finished in 1.25 s, so this
   record proves the property was *set* (accepted by the manager), not that it fires.
5. **The two hash files differ in their header comment only** (5 lines before, 3 after):
   all 27 digests are identical. The size difference (4421 vs 4233 bytes) is the
   comment, not a source.
6. No other deviation: no retry, no re-run, no source edit, no install/build, no
   delegation, no change to production. `127.0.0.1:3080` was listening before and after
   (`MainThread` pid 303282), no unit was stopped, and no failed unit was added
   (`rc-local.service` was already failed before the attempt).

## 9. Raw evidence

All in `projects/dsh-plugin-kit/docs/testing/runs/20261102T143940Z-fixture-unit/`:

| file | contents |
|---|---|
| `00-preflight.txt` | host survey (context only — explicitly not the gate) |
| `10-orchestrator.sh` | the orchestrator, copied as executed |
| `11-hashes-before.txt` | 27 source digests + run-artifact digests, before |
| `12-invocation.txt` | the single command, shell-quoted, one element per line |
| `20-envelope-runner.sh` | the in-unit runner, copied as executed |
| `20-unit-stdout.log` | the whole attempt: limits, gate, env, all 91 test lines, peaks |
| `21-unit-stderr.log` | empty (0 bytes) |
| `30-launch-exit-status.txt` | `1` |
| `50-hashes-after.txt` | the same 27 digests, after — identical |
| `60-post-attempt.txt` | journal, failed-unit list, 3080 listener, leftovers, run-dir listing |

`20-unit-stdout.log` sha256 `55004d0377…6760e33a`, `12-invocation.txt`
`be5870678e…9ed610`, `30-launch-exit-status.txt` `4355a46b19…0dd865`.

## 10. What a reader may and may not conclude

May: the envelope was really applied (kernel readback), the gate really passed on one
sample, the sources were not touched, and 88 of 91 source/contract assertions hold —
including every one covering the Lead's four corrections.

May not: that the admission slice works. Three assertions failed and were not
investigated further than reading the sources they point at, and no Loader, fiber, arm
or host ever ran here. The slice's arm status stays **NOT RUN**.
