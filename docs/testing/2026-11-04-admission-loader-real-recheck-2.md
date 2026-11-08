# admission-loader real Loader **recheck 2** — after the rollback accounting fix

**Status: RUN ONCE — ACCEPTED at the acceptance stage, node exit 0.** Four required
cases reported their expected statuses with full assertions; a canonical document and
valid diagnostics were published. One launch, no retry. Run directory
`experiments/acceptance/admission-loader-real/runs/20261103T215342Z-admission-loader-real-381286-13473/`.

This file was written as a PREPARED-NOT-RUN skeleton before the launch; §3 and §5 are
transcribed from that run directory afterwards.

## 1. Why this recheck

The first attempt (run `20261103T211530Z-…-379361-1731`) refused at evaluate with
`EVIDENCE_OBSERVATION_INCOMPLETE: closeRejection`, node exit 14. The second (run
`20261103T213251Z-…-380195-28711`) cleared that refusal — four cases, 22/22 pairs, no
document — then failed at acceptance on `rollback-disposer-ran-exactly-once` because the
throw case counted both rollback callbacks (`2`) where the evaluator requires `1`; node
exit 15.

The fixture's rollback accounting has since changed: registrations are recorded at the
call site as independent `defer-registered` events, `registered` no longer derives from
execution, and the singular count reads the designated callback's own invocation
counter. Unit-verified at 89/89 (`…-admission-loader-rollback-unit-recheck.md`), but
never run against a real Loader until now.

## 2. Constraints

- Runner unchanged: `run.sh`, `payload.sh`, `main.mjs` not edited for this attempt.
- Pinned source gate satisfied: `pinned_commit=ce7073d51254c26cd63b22a60835b8f948deb447`
  in `status.txt`, checkout clean; `SOURCE_REVIEW_PENDING = false` with both Lead-recorded
  kit digests; `source-review.json` 778 B.
- Envelope, readback: `memory.max=805306368`, `swap.max=0`, `pids.max=32`,
  `cpu.max="50000 100000"`, `Type=exec`, `RuntimeMaxSec=2min`, `acc_capture_ok=yes`.
  Read-only root, only this run's `out/` writable, private pid/net/ipc/uts, minimal env,
  node heap 384 MiB.
- Gate: `acc_gate_memavailable_kib=1782168` ≥ `acc_gate_required_kib=1228800` → `pass`.
- One launch. No fixes, no retry, no build, no install, no production change.

Preflight, before the skeleton: two prior real run directories; `admission-loader-*` list
empty (inspection rc 0); checkout at `ce7073d5…` with a clean tree; `MemAvailable`
1700180 kB.

## 3. Identity

| field | value |
| --- | --- |
| run id | `20261103T215342Z-admission-loader-real-381286-13473` |
| unit | `admission-loader-real-20261103T215342Z-381286` |
| launch rc | `0` |
| node rc | `0` (`acc_node_rc`) |
| acceptance exit | `0` |
| pinned commit | `ce7073d51254c26cd63b22a60835b8f948deb447` |
| hashed files | 19 (`hashes-before.txt` / `hashes-after.txt`, 2780 B each, `.err` 0 B) |
| hash status | `identical` (`cmp` equal, no diff file) |
| run summary | `real_exit_code=0`, `real_summary=accepted: required cases reported their expected statuses and the host teardown settled` |

## 4. Invocation

`bash experiments/acceptance/admission-loader-real/run.sh` — one invocation.

## 5. Evidence read back

### 5.1 The four required cases — 22 assertion pairs

| case | expected | observed | assertions | all passed |
| --- | --- | --- | --- | --- |
| `admission-admitted` | passed | `passed` | 7 | yes |
| `admission-refused-conflict` | refused | `refused` | 5 | yes |
| `admission-activation-throw` | passed | `passed` | 5 | yes |
| `admission-cleanup-failure` | passed | `passed` | 5 | yes |

`acceptance.failures` is empty. The refused case is a refusal, not a failure: the
diagnostics carry `ADMISSION_CASE_REFUSED` for it, kept distinct from
`ADMISSION_CASE_FAILED` (absent).

### 5.2 The rollback ledger, as observed

| fact | value | sources |
| --- | --- | --- |
| `rollback` | `registered 2 / fulfilled 2 / rejected 0 / pending 0` | `#3 #4 #7 #9` |
| `rollbackDisposerRunCount` | `1` (designated callback only) | `#8` |
| `activationThrew` | `true` | `#10` |
| `errorIdentity` | `{compared: true, same: true}` | — |
| `postThrowReservation` | `conflicted` | `#11` |

This is the reading the exit-15 run could not produce: the plural ledger settles twice
while the singular count is `1`, drawn only from the designated callback's own event.

### 5.3 Canonical document — actually present

`derived-document.json` 4303 B: `present: true`, `reason: null`; document
`schemaVersion` `admission-evidence/0.1-draft.1`; `baseline {commit: ce7073d5…, node:
v24.21.0}`; `coordination {observed-identical, not-determined, not-determined}`; four
cases with 22 `{id, passed}` entries, all `true`; per-case `limitations: []`; six
root-level limitations (synthetic cleanup fault; fixture-read close rejection; pre-apply
probe as the earliest externally visible reading; aggregate forwarding resting on source
reading not observation; a pass does not certify the shipped arm; no claim about
production `:3080`, `/root/.dsh` or any other host). Not a placeholder or an empty shell:
case ids, assertion ids and their verdicts are all present.

### 5.4 Diagnostics — valid, not certified

`diagnostics.json` 4149 B: `present: true`; `valid: true`; `certification: false`;
`issues: []`; findings `ADMISSION_CASE_REFUSED` (refused-conflict) plus four
`ADMISSION_COVERAGE_UNKNOWN` for the optional cases (`lease-state`, `tuple-shape`,
`remount-same-coordinator`, `visibility`) — absent, and explicitly never read as passes.
`summary.coverage` = required 4 / present 4 / unknown 4; every case has
`failedAssertions: []`.

### 5.5 Lifecycle, independent of the verdict

`booted: true`; coordinator row `active`, settled; scenario row settled with
`finalState: disposed`; `coordinatorServicePresent: true`; `scenarioStatus: applied`;
`coordinatorUnload {settled: true, stateName: "disposed"}`; `fiber {settled:
"fulfilled"}`; cleanup `status: drained`, finished all four cases, `skipped: []`,
`threw: []`; `teardown {settled: "fulfilled", reason: null}`. The teardown stands on its
own readings, not on the verdict.

### 5.6 Resources and unit cleanup

`acc_node_rc=0`; workload wall `3879 ms`; `acc_memory_peak=173740032`, current at exit
`62464000`; `acc_pids_peak=15`; memory events all zero. Unit after run:
`LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list
empty.

Raw artifacts: `argv.txt` 2647 B, `hashes-before.txt` 2780 B, `hashes-after.txt` 2780 B
(`.err` 0 B each), `unit.log` 4623 B, `journal.txt` 879 B, `systemd-run.rc` 2 B,
`status.txt` 222 B, `out/observation.json` 23241 B, `out/derived-document.json` 4303 B,
`out/diagnostics.json` 4149 B, `out/raw-outcome.json` 1790 B, `out/source-review.json`
778 B.

### 5.7 Selected hash delta versus the exit-15 run

Same nineteen-file set; exactly one line differs:

| file | exit-15 run | this run |
| --- | --- | --- |
| `experiments/admission-loader-fixture/fixtures/scenarios.mjs` | `24df6e32…f18e4` | `c49e91aa…69b3c` |

The other eighteen, including `run.sh`, `payload.sh` and `main.mjs`, are byte-identical.

## 6. What this record does not claim

1. Not a certification, and not a proof that the kit is correct. The loop's own
   limitation says acceptance means the four cases reported their expected statuses with
   full assertions; `certification: false` is in the diagnostics.
2. Not causal exclusivity. One selected input changed; that shows the runner and the
   other listed inputs did not change, and nothing more. An unlisted module, timing or
   machine state is outside the witness. I do not claim the accounting fix *caused* the
   pass — only that the run now passes and the ledger reads as recorded above.
3. Not a closure. Nineteen selected files are a witness over identified inputs; these
   sources are untracked, so `pinned_commit` names the tree they are mounted into, not
   them. The hash pair is evidence of bytes at two moments, never provenance.
4. Not coverage of the four optional cases: they were never attempted, so their coverage
   is `unknown`, and absence is not a pass.
5. Not an observation of a real cleanup fault: the injected `SyntheticCleanupFault` is
   deliberate, as the document's own limitation states.
6. Not a rendered or forwarded quotation of free-form `limitations[]` or `baseline.node`.
7. Not a claim about production `:3080`, `/root/.dsh`, or any host other than the
   throwaway home this run created.
8. Not reproducible from HEAD alone, for the reason in 3.
9. Not whole-host health: `unit.log:30-50` reports 20 unrelated entries pending on unavailable services (including filesystem, shell and subagent services). The target fixture rows and their teardown were observed separately; the accepted result does not establish those other plugins activated.

## 7. Gate

One attempt, spent. The run finished accepted with node exit 0 and nothing was retried,
re-fixed or re-run. The exit-14 and exit-15 records are preserved and are not restated,
upgraded or retroactively repaired by this one. No further execution follows without a
new GO and its own record.
