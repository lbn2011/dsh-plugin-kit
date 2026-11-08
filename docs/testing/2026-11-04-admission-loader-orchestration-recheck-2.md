# admission-loader-fixture ORCHESTRATION unit slice — RECHECK 2 (2026-11-04)

**Status: RUN ONCE. 47 tests, 47 pass, 0 fail, node exit 0.**

Both targets loaded, executed and passed. This is the first green result for this
slice, and it is deliberately narrow: it is a **unit** result over mocks and
filesystem preparation, not real Loader acceptance.

## 1. Why this attempt exists

Three attempts are on record, each standing as measured:

| run | outcome |
|---|---|
| `runs/20261103T201109Z-…-376656-12899` | 2 files failed to load, **0 assertions executed**, node exit 1 (duplicate `const entry` in `prepare.mjs`) |
| `runs/20261103T201548Z-…-376916-221` | **45 tests, 40 pass, 5 fail**, node exit 1 |
| `runs/20261103T202649Z-…-377399-2448` | **47 tests, 47 pass, 0 fail**, node exit 0 ← this record |

The five failures and their corrections are the **author's `§§10–11` in
`2026-11-04-admission-loader-orchestration-recheck.md`**. That analysis is theirs,
not mine; this document neither restates nor certifies it. What this document
records is only what the launch returned.

## 2. Constraints observed

Same two literal targets, one serial `node --test --test-concurrency=1`, same caps
(`Type=exec`, 768M, swap 0, TasksMax 32, CPUQuota 50%, RuntimeMaxSec 120, heap 384),
same shared acceptance lock, same single in-unit `MemAvailable >= 1200 MiB` gate,
same sandbox. One launch; no retry, no polling, no escalation, no automatic fix. Both
earlier run directories were left exactly as written.

No real Loader, no host, no install, no build, and no node invocation outside the
single `--test` inside the unit.

## 3. Run identity (read back)

| field | value |
|---|---|
| run id | `20261103T202649Z-admission-loader-orchestration-unit-377399-2448` |
| unit | `admission-loader-orchestration-unit-20261103T202649Z-377399` |
| run directory | `experiments/acceptance/admission-loader-orchestration-unit/runs/20261103T202649Z-admission-loader-orchestration-unit-377399-2448/` |
| repo HEAD | `effb9581687f995841d872304e03627473039957` — unchanged across all three runs |
| node | `/www/server/nodejs/v24.21.0/bin/node` — path only, never probed |
| launched (UTC) | `2026-11-03T20:26:49Z` per the run-id stamp |

## 4. Evidence captured

| field | actual value |
|---|---|
| systemd-run exit | `0` (`systemd-run.rc`, 2 B) |
| node exit | `acc_node_rc=0` |
| tests / pass / fail / skipped | `47 / 47 / 0 / 0`, suites `0`, duration `387.80 ms` |
| gate sample | `acc_gate_memavailable_kib=1848156` ≥ `1228800` ⇒ `acc_gate=pass`, sampled once |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit readback | `Type=exec`, `RuntimeMaxUSec=120000000` (resolved from `2min`); `acc_capture_ok=yes` |
| memory.peak | `71016448` B (67.7 MiB) |
| memory.current at exit | `35921920` B |
| pids.peak | `20` of 32 |
| memory.events.local | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` |
| wall time | `acc_workload_wall_ms=771`; journal CPU `351 ms` |
| hashes before/after | `hash_status=identical`; both `.err` 0 B; no `hashes-diff.txt` |
| acceptance exit | `0` |
| cleanup / unit state | `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; `admission-loader-*` list empty; journal "Deactivated successfully" |
| failure marks in log | none (`✖` count 0) |

Raw paths (all in the run directory above): `argv.txt` 2676 B,
`hashes-before.txt` / `hashes-after.txt` 2966 B each, `unit.log` 5558 B,
`systemd-run.rc` `0`, `journal.txt` 727 B, `status.txt` 194 B.

## 5. The five formerly failing tests, and the two added ones

Each previously failing test now reports `✔` in this run's log, at the same titles:

```
✔ a work parent must exist, be a real directory and be canonical
✔ a green prepare returns exactly the collector options and lists what it made
✔ the trusted source-review flag defaults to false and is copied, not aliased
✔ a thrown evaluator is a fixed label and keeps prepare and collect
✔ a thrown chain keeps evaluation and reports chain-threw
```

The two throw paths the author's §10.2 says were added are also present and green:

```
✔ a thrown preparer is a fixed label and stops before any host work
✔ a thrown collector keeps prepare and stops before evaluation
```

The count moved from 45 to 47 tests, which matches two added cases.

## 6. Hash comparison with the 40/45 run

A full diff of the two `hashes-before.txt` files yields **exactly three changed
lines**, all files the corrections touched:

| file | 40/45 run | recheck 2 |
|---|---|---|
| `tests/prepare.test.mjs` | `87d8650e…644a0` | `3a247f65…5e8bc` |
| `tests/run-loop.test.mjs` | `3788ef17…6574e` | `cc8ff484…466d0` |
| `prepare.mjs` | `59b3f2d7…e058f` | `b580215e…12c99` |
| the other 17 hashed files | — | identical — verified by diff, not assumed |

`run.sh` and `payload.sh` are among the unchanged 17, so the runner text is
byte-identical to the run that produced 40/45: the outcome changed because the three
disclosed sources changed, not because the harness moved.

The set is still 20 identified files — two targets, two runner scripts, sixteen
selected inputs — so this is a **witness over identified inputs, not a closure**.
Node builtins are excluded, and a deeper module that changed without appearing in
the list would not be caught. "Identical" means *these 20 files did not change during
the run*, never that nothing changed.

## 7. What this result does not claim

- **Not real Loader acceptance.** `prepare.test.mjs` exercises filesystem
  preparation against directories it creates under `os.tmpdir()`; `run-loop.test.mjs`
  drives the loop with every stage mocked. No Loader, fiber, host, plugin runtime or
  browser was launched. The collect-against-a-real-Loader gap stays open, and nothing
  here may be quoted as realLoader evidence.
- **Not a closure proof**, per §6.
- **Not a re-baseline** of the two earlier runs. The 0-assertion load failure and the
  40/45 result stand as measured, with their artifacts untouched.
- **Not a diagnosis.** §5 reports that those titles now pass; it does not re-derive
  why the author's edits worked, and does not certify their analysis.
- **Not a process-compliance claim.** See §8.

## 8. Process note

This record covers one launch and its readback. The author's own deviation
disclosure — read-only shell scans used while diagnosing, and a delimiter-count
observation that the Lead ruled is not a JS validity proof — lives in
`2026-11-04-admission-loader-orchestration-recheck.md` §11 and is theirs. It is
referenced, not repeated or endorsed here, and nothing in this document should be
read as certifying the whole process as compliant.

## 9. Gate

One attempt was authorised; it has run, once, and returned 47/47 with node exit 0.
No fourth run is authorised, nothing was retried, and no source or runner was edited
in response to this result. The green number describes these two targets under this
envelope on this tree at HEAD `effb958…`; it is not a standing property.
