# Admission optional-case unit slice — recheck of the failed attempt

**Status: RUN ONCE, 161/160/1, NOT GREEN.** One attempt ran; counts are **161 tests
/ 10 suites / 160 pass / 1 fail / 0 cancelled / 0 skipped / 0 todo**, node exit 1.
The single failure is a **load-time** `SyntaxError` in
`tests/optional-collection.test.mjs`, so that file's tests never executed. The
skeleton text below was written before the launch; §8 was appended afterwards from
the run directory.

- Slice: `experiments/acceptance/admission-optional-unit/` (unit only, no Loader).
- Preserved antecedent: `2026-11-04-admission-optional-unit.md` — one attempt,
  **137 tests / 122 pass / 15 fail**, node exit 1, run
  `runs/20261104T141332Z-admission-optional-unit-403410-24542/`. That record is not
  edited by this recheck, and its failures stay failures.
- Author: subagent session under the Lead identified in the antecedent record's §7.

## 1. Why a second attempt exists

The first attempt failed in two groups: `tests/run-loop.test.mjs` did not load (a
wrong relative import, in a file this slice does not own), and
`tests/optional-collection.test.mjs` reported fourteen failures. Two files owned by
other work changed after that attempt — the collector's `collect.mjs` and
`tests/optional-collection.test.mjs` — and the run-loop import was corrected. None
of those changes has been measured. This recheck exists to measure them once.

It does **not** exist to make the first run look better. The first run measured the
bytes it measured; this records different bytes.

## 2. Constraints, fixed before the launch

- Exactly **one** invocation, `bash experiments/acceptance/admission-optional-unit/run.sh`,
  unchanged. No source edit, no runner edit, no standalone syntax or version check.
- The same five literal targets, the same shared lock
  (`experiments/acceptance/runs/.acceptance.lock`), the same
  `admission-*` fail-closed unit inspection, the same exclusive run directory.
- The same envelope: `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`,
  `TasksMax=32`, `CPUQuota=50%`, `RuntimeMaxSec=120`, node heap `384`,
  bwrap read-only root with private pid/net/ipc/uts and `env -i`, and exactly one
  `MemAvailable >= 1200 MiB` gate.
- No polling, no retry, no cap increase, no host, no install, no build.
- On failure: record it and stop. Diagnosis by reading only; no fix, no third
  attempt.

## 3. Identity, to be read back

| Field | Value |
| --- | --- |
| run id | `20261104T142934Z-admission-optional-unit-404004-9470` |
| unit | `admission-optional-unit-20261104T142934Z-404004` |
| slice | `admission-optional-unit` |
| launch | `bash experiments/acceptance/admission-optional-unit/run.sh` |

## 4. Expected evidence

| Artifact | Expected |
| --- | --- |
| `status.txt` | run id, unit, `systemd_run_rc`, `hash_status`, `acceptance_exit` |
| `argv.txt` | the five literal targets, `hashed_files=` |
| `hashes-before.txt` / `hashes-after.txt` | 25 lines each |
| `unit.log` | envelope readback lines (`acc_*`) plus the reporter summary |
| `journal.txt` | unit journal |
| `systemd-run.rc` | the launch's own exit |

## 5. Comparison with the first run — predicted, then measured

The selected hash set is a witness over identified inputs, not a closure, so a
comparison of its lines can say which of *these* files changed and nothing about
anything else. Predicted changes, all owned by other work:

| File | Prediction |
| --- | --- |
| `experiments/acceptance/admission-loader-fixture/collect.mjs` | expected to differ |
| `experiments/acceptance/admission-loader-fixture/tests/optional-collection.test.mjs` | expected to differ |
| `experiments/acceptance/admission-loader-fixture/tests/run-loop.test.mjs` | expected to differ (import fix) |
| the other 22 files | expected identical — *to be measured, not assumed* |

A difference is not a cause. Three changed files do not exclude an unlisted input,
a timing effect or an environment difference, and this record will not claim
exclusive causation. The parent HEAD identifies the tracked tree; these
`experiments/` sources are untracked, so HEAD is not their version.

**Measured delta (25-line sets, `diff` of the two `hashes-before.txt`): exactly
three lines differ, and they are the three predicted ones.** `collect.mjs`
`1733c58e…` → `1e12e0c4…`; `tests/optional-collection.test.mjs` `627a2d5a…` →
`bbac3ba3…`; `tests/run-loop.test.mjs` `10d62268…` → `799ad6f1…`. The other 22
files are byte-identical. This says which of these 25 files changed; it does not
say that nothing else did, and it does not make any of the three a cause.

## 6. What this record will not claim

1. Not that the optional four cases are covered, and not that the eight-case
   real-Loader path works. This slice boots no Loader.
2. Not that the first run's failures were "really" passes. It measured other bytes.
3. Not a closure over dependencies; 25 selected files are a witness.
4. Not a certification, and not an acceptance receipt.
5. Not a causal explanation of any count difference beyond what the log shows.

## 7. Gate

The single authorised attempt has been spent. No further attempt follows from this
document; a third run would need its own authorisation and its own record.

## 8. Outcome

Run `runs/20261104T142934Z-admission-optional-unit-404004-9470/`, unit
`admission-optional-unit-20261104T142934Z-404004`.

| Field | Measured |
| --- | --- |
| `systemd_run_rc` | `1` |
| `acc_node_rc` | `1` |
| `acceptance_exit` | `1` |
| `hash_status` | `identical` (25 before / 25 after, `cmp` equal) |
| tests / suites | `161` / `10` |
| pass / fail | `160` / `1` |
| cancelled / skipped / todo | `0` / `0` / `0` |
| duration | `1171.555813 ms` |
| envelope | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"`, `Type=exec`, runtime resolved `120000000` µs, `acc_capture_ok=yes` |
| gate | `1484928 ≥ 1228800` KiB (the same sample the first run recorded), `acc_gate=pass` |
| heap cap | `384` MiB |
| wall / peak / current | `1586 ms` / `74502144` B / `34938880` B |
| pids peak | `20` |
| `memory.events.local` | all zero |
| unit after run | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, no `admission-*` unit listed |

**The one failure is a parse error, not a test failure.** Verbatim from `unit.log`:

```
file:///root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/optional-collection.test.mjs:377
          held.delete(name)
              ^

SyntaxError: Unexpected token '.'
    at compileSourceTextModule (node:internal/modules/esm/utils:319:16)
```

The reporter then records `test at experiments/admission-loader-fixture/tests/optional-collection.test.mjs:1:1`
and `✖ … (86.221481ms)` with `'test failed'`. Because the module never compiled,
**none of that file's tests ran** — the fourteen optional-collection failures of
the first attempt were neither reproduced nor cleared; they were not executed.

What did run and pass: all of `tests/evaluate.test.mjs` (including the ten
optional-case tests), `tests/prepare.test.mjs`, `tests/scenarios-contract.test.mjs`,
and — unlike the first attempt — `tests/run-loop.test.mjs`, which now loads and
whose tests all pass. That is why the total rose from 137 to 161 while the failure
count fell from 15 to 1: one file started running, another stopped.

Read-only diagnosis, offered as a reading of the bytes and not as a repair: the
token after `held.delete(name)` suggests the line was edited into a state where a
statement boundary was lost — a property access whose receiver is not an
identifier, or a missing separator before it. Nothing was changed to confirm this,
and the file belongs to other work.

No claim is made here that the eight-case real-Loader path works, that the optional
four are covered, or that the first run's failures are resolved.
