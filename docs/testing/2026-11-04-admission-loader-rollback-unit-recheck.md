# admission-loader rollback accounting — unit **recheck**

**Status: RUN ONCE — 89 tests, 89 pass, 0 fail, 0 skipped; node exit 0.** One launch, no
retry. Run directory
`experiments/acceptance/admission-loader-unit/runs/20261103T215025Z-admission-loader-unit-381052-17968/`.

This file was written as a PREPARED-NOT-RUN skeleton before the launch; §3 and §5 are
transcribed from that run directory afterwards.

## 1. Why this recheck

The previous attempt of the same slice (`…-rollback-unit.md`, run
`20261103T214511Z-admission-loader-unit-380671-26846`) measured 89 tests / 88 pass /
1 fail. The real-coordinator rollback regression passed; the omission negative control
failed on its own envelope premise — it declared `coordinatorIdentity: 'not-compared'`
while also supplying a comparison fact saying `same: true`, a contradiction the
evaluator refuses. That failure is preserved there and is not restated by this record.

Two changes were made to `tests/scenarios-contract.test.mjs` afterwards:

- the comparison fact is now `{ observed: false }`, matching a mock that never compares
  coordinator objects;
- the `evaluated.ok` assertion now prints the evaluator's own `code` and `detail` on
  failure, so a refusal is visible in the log instead of only `expected true`.

Outcome of this recheck: both titles pass (below). Unit attempt only — no Loader, no
host, no plugin runtime, no browser.

## 2. Constraints

- Runner **unchanged**: `run.sh` and `payload.sh` unedited and byte-identical across the
  two runs; both are inside the seventeen-file hash set.
- Exactly two literal targets, no discovery: `targets=` in `argv.txt` names
  `tests/evaluate.test.mjs` and `tests/scenarios-contract.test.mjs`.
- Envelope as launched: `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`,
  `RuntimeMaxSec=120`, `CPUQuota=50%`, node heap 384 MiB.
- One `MemAvailable >= 1200 MiB` sample inside the unit before the workload.
- Shared serial queue `experiments/acceptance/runs/.acceptance.lock`.
- One launch; no retry, no repair, no further fix, no install, no build, no real host.

Preflight, before the skeleton: four prior run directories present; `admission-loader-*`
list empty (inspection rc 0); `MemAvailable` 1727120 kB.

## 3. Identity

| field | value |
| --- | --- |
| run id | `20261103T215025Z-admission-loader-unit-381052-17968` |
| unit | `admission-loader-unit-20261103T215025Z-381052` |
| launch rc | `0` (`systemd_run_rc`) |
| node rc | `0` (`acc_node_rc`) |
| acceptance exit | `0` |
| hashed files | 17 (`hashes-before.txt` 17 lines, `hashes-after.txt` 17 lines) |
| hash status | `identical` (`cmp` equal, no `hashes-diff.txt`) |
| HEAD | *not captured* — the runner does not record it, and these experiment sources are untracked, so HEAD would not identify them |

## 4. Invocation

`bash experiments/acceptance/admission-loader-unit/run.sh`

One invocation. `argv.txt` records the launch:
`systemd-run --wait --pipe --collect --unit=… --property=Type=exec
--property=MemoryMax=768M --property=MemorySwapMax=0 --property=TasksMax=32
--property=RuntimeMaxSec=120 --property=CPUQuota=50%
--property=WorkingDirectory=… -- /bin/bash …/payload.sh <unit>`.

## 5. Evidence read back

| reading | actual |
| --- | --- |
| tests / suites / pass / fail / cancelled / skipped / todo | `89 / 9 / 89 / 0 / 0 / 0 / 0` |
| duration | `510.216578 ms` |
| `the real coordinator runs both registered rollback callbacks and counts the designated one` | `✔` at `unit.log:132`, `0.675955ms` |
| `a registered rollback callback that never ran cannot be reported as settled` | `✔` at `unit.log:133`, `1.030882ms` |
| failure markers in the log (`✖`) | `0` |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit properties | `Type=exec`, `RuntimeMaxSec=2min` |
| capture | `acc_capture_ok=yes` |
| gate sample | `acc_gate_memavailable_kib=1668096` ≥ `acc_gate_required_kib=1228800` → `acc_gate=pass` |
| memory peak | `acc_memory_peak=69091328` (journal: 65.8M, swap 0B) |
| memory at exit | `acc_memory_current_final=32890880` |
| pids peak | `acc_pids_peak=20` |
| memory events | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| workload wall | `acc_workload_wall_ms=839` |
| cpu | `388ms` (journal) |
| hash pair | identical, 2511 B each, `.err` 0 B |
| unit after run | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list empty |

Raw artifacts: `argv.txt` 2320 B, `hashes-before.txt` 2511 B, `hashes-after.txt` 2511 B
(`.err` 0 B each), `unit.log` 9874 B, `journal.txt` 615 B, `systemd-run.rc` 2 B,
`status.txt` 167 B.

### 5.1 Hash comparison with the 88/89 run

Same seventeen-file set; exactly one line differs:

| file | 88/89 run | this run |
| --- | --- | --- |
| `experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs` | `e8c3f8f0…750ec` | `b82a5891…ec0f4` |

The other sixteen, including `run.sh` and `payload.sh`, are byte-identical. This matches
the disclosed change and nothing else — it is not a claim that nothing else could
differ (see §7.3).

## 6. Counts are from the log, and the evaluator assertion

Counts are transcribed, not predicted. Both titles appear individually (`:132`, `:133`),
so both executed.

On the negative control's internal gate: the log prints no per-assertion lines, so I
state the reasoning rather than reading it off. The test body has no early return — it
computes the ledger, asserts it, asserts `evaluated.ok === true`, finds the throw case,
requires `status === 'failed'` and requires
`registered-rollback-callbacks-settled.passed === false`, then requires the
outstanding-registration limitation. A `✔` therefore means every one of those
assertions held, including the actual-evaluator one. That is an inference from the test
source, not a printed measurement; a failing envelope would now also print the
evaluator's `code` and `detail` (added for this attempt), and no such message appears.

## 7. What this record does not claim

1. Not acceptance evidence. No Loader was launched; `2026-11-04-admission-loader-real-recheck.md`
   stands as measured, with its `failed` activation-throw case and no published document.
2. Not proof that the rollback accounting is correct in general. It shows that, for a
   mock coordinator that registers two callbacks and retains one, the fixture reports
   `registered 2 / fulfilled 1 / pending 1` and the actual evaluator produces a `failed`
   case with the outstanding limitation — and that the real-coordinator case passes.
3. Not an unchanged-input comparison with the 88/89 run. One selected input changed and
   is disclosed in §5.1; selected hashes show the runner and the other listed inputs did
   not change, and nothing beyond that. An unlisted transitive module, timing or machine
   state is outside the witness.
4. Not provenance: the hash pair identifies bytes of a selected set at two moments, and
   these sources are untracked, so HEAD is not their version id.
5. Not a diagnosis of anything the log does not print (§6).
6. Not a change to the protocol: evaluator assertions and ids are untouched, and the
   canonical spec is unchanged.

## 8. Gate

One attempt, spent. The run finished 89/89 with node exit 0 and nothing was retried,
repaired or re-run. No further execution follows without a new GO and its own record.
