# admission-loader rollback accounting — unit attempt

**Status: RUN ONCE — 89 tests, 88 pass, 1 fail, 0 skipped; node exit 1. NOT green.**
One launch, no retry. Run directory
`experiments/acceptance/admission-loader-unit/runs/20261103T214511Z-admission-loader-unit-380671-26846/`.

This file was written as a PREPARED-NOT-RUN skeleton before the launch; §3 and §5 are
transcribed from that run directory afterwards.

## 1. What this attempt was for

The previous attempt of the same slice (run
`20261103T212950Z-admission-loader-unit-379897-6349`) measured 87 tests / 87 pass. Two
tests were added since, both about the `admission-activation-throw` rollback ledger:

- `the real coordinator runs both registered rollback callbacks and counts the
  designated one` — the kit's own coordinator, in process, registering two rollback
  callbacks; asserts the plural ledger settles twice while the singular "exactly once"
  count is the designated callback's own counter.
- `a registered rollback callback that never ran cannot be reported as settled` — a
  mock coordinator accepting both `context.defer` calls and retaining only the first;
  the facts are then handed to the **actual** evaluator, which must produce a `failed`
  case rather than acceptance.

Outcome: the first passed; the second failed, on its own premise rather than on the
property it is named for (§6.1).

Unit attempt only: no Loader, no host, no plugin runtime, no browser.

## 2. Constraints this attempt inherited

- The runner was **unchanged**: `run.sh` and `payload.sh` were not edited, and both are
  inside the seventeen-file hash set, whose before/after pair is byte-identical
  (`cmp` equal, 2511 B each, `.err` empty).
- Exactly two literal targets, listed in both scripts, no discovery:
  `tests/evaluate.test.mjs` and `tests/scenarios-contract.test.mjs` under
  `experiments/admission-loader-fixture/` (also echoed as `targets=` in `argv.txt`).
- Envelope as launched: `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`,
  `TasksMax=32`, `RuntimeMaxSec=120`, `CPUQuota=50%`, node heap 384 MiB.
- One `MemAvailable >= 1200 MiB` sample taken inside the unit before the workload.
- Shared serial queue: `experiments/acceptance/runs/.acceptance.lock`.
- One launch; no retry, no repair, no install, no build, no real host.

Pre-launch, one correction was made **to this record only**: a path in §2 read
`tables/evaluate.test.mjs` and was fixed to `tests/`. No script, test or fixture was
touched between the skeleton and the launch.

## 3. Identity

| field | value |
| --- | --- |
| run id | `20261103T214511Z-admission-loader-unit-380671-26846` |
| unit | `admission-loader-unit-20261103T214511Z-380671` |
| launch rc | `1` (`systemd_run_rc`) |
| node rc | `1` (`acc_node_rc`) |
| acceptance exit | `1` |
| hashed files | 17 (`hashes-before.txt` 17 lines, `hashes-after.txt` 17 lines) |
| hash status | `identical` (no `hashes-diff.txt`) |
| HEAD | *not captured* — the runner does not record it, and these experiment sources are untracked, so HEAD would not identify them anyway |

## 4. Invocation

`bash experiments/acceptance/admission-loader-unit/run.sh`

One invocation. The launch line is `argv.txt`: `systemd-run --wait --pipe --collect
--unit=… --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0
--property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50%
--property=WorkingDirectory=… -- /bin/bash …/payload.sh <unit>`.

## 5. Evidence read back

| reading | actual |
| --- | --- |
| tests / suites / pass / fail / cancelled / skipped / todo | `89 / 9 / 88 / 1 / 0 / 0 / 0` |
| duration | `683.814755 ms` |
| `the real coordinator runs both registered rollback callbacks…` | `✔` at `unit.log:132`, `0.672928ms` |
| `a registered rollback callback that never ran…` | `✖` at `unit.log:133`, `1.533458ms` |
| `the real coordinator keeps the fixture error across a failed close` | `✔` at `unit.log:131`, `1.615504ms` (still green) |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit properties | `Type=exec`, `RuntimeMaxSec=2min`, `MemoryMax=805306368`, `TasksMax=32` |
| gate sample | `acc_gate_memavailable_kib=1799068` ≥ `acc_gate_required_kib=1228800` → `acc_gate=pass` |
| memory peak | `acc_memory_peak=69206016` (journal: 66M, swap 0B) |
| memory at exit | `acc_memory_current_final=34160640` |
| pids peak | `acc_pids_peak=20` |
| memory events | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| workload wall | `acc_workload_wall_ms=1077` |
| cpu | `454ms` (journal), service runtime `1.165s` |
| hash pair | before/after identical, 2511 B each, `.err` 0 B |
| unit after run | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list empty |

Raw artifacts: `argv.txt` 2320 B, `hashes-before.txt` 2511 B, `hashes-after.txt` 2511 B
(`.err` 0 B each), `unit.log` 10643 B, `journal.txt` 725 B, `systemd-run.rc` 2 B,
`status.txt` 167 B.

## 6. Counts are from the log, not from expectation

The two new titles appear individually in `unit.log` (`:132`, `:133`), so both executed.
The suite-level ticks are not treated as per-case results.

## 6.1 The failure, transcribed

```
test at experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs:810:1
✖ a registered rollback callback that never ran cannot be reported as settled (1.533458ms)
  AssertionError [ERR_ASSERTION]: the envelope is well formed, so the verdict is computed rather than refused
  false !== true
      at TestContext.<anonymous> (file:///…/tests/scenarios-contract.test.mjs:908:10)
```

**What the log states:** my own assertion that the envelope was well formed failed,
i.e. `evaluateObservations` returned `ok: false`.

**What I infer, from source — not from the log.** The log does not print the refusal
code. Reading `evaluate.mjs:428-438`, `readCoordination` compares the declared identity
state against the comparison fact: with a comparison present and `same: true`, the state
must be `observed-identical`. My envelope declared `coordinatorIdentity: 'not-compared'`
while also supplying `coordinationIdentityComparison: { observed: true, value: { same:
true } }`, which is the contradictory pair, so the refusal would be
`EVIDENCE_COORDINATION_INVALID` ("identity state contradicts the comparison fact").

**Consequence.** The negative control never reached the assertion it exists for. The
fixture's own numbers were computed and asserted earlier in the same test and the log
reports no failure before this line, but "the evaluator rejects a dropped callback" is
**not** established by this run. The defect here is in my test's envelope, not in the
fixture: the evaluator refused a malformed premise, which is the behaviour §6.4 asks
for.

## 7. Deviations and what this record will not claim

1. **Deviation:** the negative control failed on its envelope premise (§6.1). No repair
   was attempted; the failure stands as measured.
2. Not acceptance evidence. No Loader was launched; `2026-11-04-admission-loader-real-recheck.md`
   stands as measured, with its one `failed` case and no published document.
3. Not proof that the rollback accounting is correct. One case passes; the omission
   control that would have exercised the accounting against the evaluator did not run to
   its assertion.
4. Not an unchanged-input comparison with the 87/87 run: `fixtures/scenarios.mjs` and
   `tests/scenarios-contract.test.mjs` have both changed since.
5. Not provenance. The hash pair identifies the bytes of a selected set at two moments,
   not a closure over what the tests load.
6. Not a diagnosis of anything the log does not print; §6.1 says explicitly which part
   is transcription and which is source inference.
7. Not a step toward changing the protocol: evaluator assertions and ids are untouched,
   and the canonical spec is unchanged.

## 8. Gate

The authorised attempt is spent. The run stopped at 88/89 with node exit 1; nothing was
retried, repaired or re-run, and no further execution follows this attempt without a new
GO and its own record.

## 9. Correction applied after the run — NOT RUN

Appended later. §1–§8 are untouched: the run still reads 89 tests, 88 pass, 1 fail,
node exit 1, and the negative control still failed on its envelope premise.

### 9.1 The defect, confirmed from source

`evaluate.mjs:428-438` requires the declared identity state to agree with the comparison
fact: with a comparison present and `same: true`, the state must be `observed-identical`.
The test declared `coordinatorIdentity: 'not-compared'` *and* supplied
`coordinationIdentityComparison: { observed: true, value: { same: true } }`. Those two
cannot both hold, so `readCoordination` would return `EVIDENCE_COORDINATION_INVALID`
("identity state contradicts the comparison fact"). The evaluator refused a
self-contradictory envelope, which is correct behaviour — the fault was in my test.

### 9.2 What was changed in the test

1. `coordinationIdentityComparison` is now `{ observed: false }`, keeping
   `coordinatorIdentity: 'not-compared'`. The reason is a fact about the harness, not a
   workaround: this mock coordinator never compares coordinator objects, so there is no
   comparison to report. Claiming `observed-identical` would fabricate a comparison that
   never happened — the same class of invention the evaluator exists to catch.

2. The `evaluated.ok` assertion now carries the evaluator's own fixed code and detail on
   failure:
   `the evaluator refused the envelope: ${code} — ${detail}`. Both are closed vocabulary
   produced by this evaluator; neither echoes envelope contents, so a refusal becomes
   visible in the next log without dumping input.

Unchanged: every ledger assertion (`registered 2`, `fulfilled 1`, `rejected 0`,
`pending 1`, and `fulfilled + rejected + pending === registered`), the retained-callback
invocation count, `status === 'failed'`, the `registered-rollback-callbacks-settled`
`passed === false` check, and the outstanding-registration limitation pass-through. The
fixture, the evaluator, the protocol, the kit and the runner are untouched.

### 9.3 What this correction does and does not establish

It has not been executed. No count in this record changes: this slice stands at 88/89
from the run above. Whether the negative control now reaches its assertion is unknown
until a new authorised attempt; and even that would establish only that the actual
evaluator refuses a case whose registration ledger carries an outstanding callback, not
that the fixture's accounting is correct in general. A further attempt needs its own GO
and its own record, and `tests/scenarios-contract.test.mjs` is in the seventeen-file hash
set, so it will show a changed hash.

**Linkage, added later:** that separate attempt has since been made and is recorded in
`2026-11-04-admission-loader-rollback-unit-recheck.md` (one launch, 89 tests / 89 pass /
0 fail, node exit 0, exactly one hashed line changed against this run). Nothing in §1–§9
above is retracted, re-graded or retroactively repaired: this run remains 88/89 with the
negative control failing on its envelope premise.
