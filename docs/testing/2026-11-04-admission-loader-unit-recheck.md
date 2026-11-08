# admission-loader-fixture unit slice — RECHECK (2026-11-04)

**Status: RUN ONCE. 86 tests, 86 pass, 0 fail. Node exited 0. The corrected
assertion passed. This does not retroactively change the first run's 85/86.**

One authorised recheck of the same bounded unit, using the **unchanged** runner
`bash experiments/acceptance/admission-loader-unit/run.sh`. The only source change
since the first run is the corrective edit to one assertion in
`experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs` (the
case/assertion-pair fix). No other source, schema, evaluator or runner file was
touched.

## 1. Why this recheck exists

The first run (`runs/20261103T195456Z-admission-loader-unit-375881-2592/`) reported
**86 tests, 85 pass, 1 fail**, node exit 1. The failing test asserted a global
count of 22 unique assertion *names*; the spec actually defines 22 case/assertion
*pairs* carrying 21 unique names, because `disposer-ran-exactly-once` is specified
for both `admission-admitted` and `admission-cleanup-failure`. The Lead diagnosed
this from `spec/admission-evidence.md` §6.2, and the test was corrected to assert
pair uniqueness (22 pairs, 21 names, shared name pinned).

This recheck asks one question only: **with that corrected assertion, does the same
unit pass?** It does not re-open any other case, and it is not a search for a green
result.

## 2. Constraints carried over, unchanged

- Same two literal targets, same single `node --test --test-concurrency=1`
  invocation, same caps (`Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`,
  `TasksMax=32`, `CPUQuota=50%`, `RuntimeMaxSec=120`, heap 384 MiB), same shared
  acceptance lock, same single in-unit `MemAvailable >= 1200 MiB` gate.
- One launch. No retry, no polling, no escalation, no automatic fix.
- The first run directory is preserved as written: nothing is edited, moved or
  deleted there.
- A preflight refusal or any failure **stops** the attempt. It is not worked around.

## 3. Run identity

| field | value |
|---|---|
| prepared (local) | 2026-11-04, before the second launch |
| launched (UTC) | `2026-11-03T20:01:08Z` (run id stamp) |
| run id | `20261103T200108Z-admission-loader-unit-376214-24737` |
| unit | `admission-loader-unit-20261103T200108Z-376214` |
| repo HEAD | `effb9581687f995841d872304e03627473039957` (same as the first run) |
| node | `/www/server/nodejs/v24.21.0/bin/node` — path only, never probed |
| competing workers | checked before launch: no `admission*`/`acceptance*` units active, load `0.58`, MemAvailable `1731888` kB; only the harness's own processes running |

## 4. The invocation

Unchanged runner, no arguments:

```
bash experiments/acceptance/admission-loader-unit/run.sh
```

Its prepared argv and in-unit workload are those recorded in the first run's
`argv.txt` and in `README.md`; this recheck adds no property and removes none.

## 5. Evidence captured

Run directory:
`/root/dsh-ecosystem-spec/experiments/acceptance/admission-loader-unit/runs/20261103T200108Z-admission-loader-unit-376214-24737/`

Files present: `argv.txt` (2320 B), `hashes-before.txt` (2511 B),
`hashes-after.txt` (2511 B), `hashes-before.err` (0 B), `hashes-after.err` (0 B),
`unit.log` (9593 B), `systemd-run.rc` (2 B), `journal.txt` (615 B),
`status.txt` (167 B). No `hashes-diff.txt`: nothing differed.

| field | actual value |
|---|---|
| systemd-run exit | `0` (`systemd-run.rc`, `status.txt: systemd_run_rc=0`) |
| node exit | `acc_node_rc=0` |
| tests / pass / fail / skipped | `86 / 86 / 0 / 0`, suites `9`, duration `500.7 ms` |
| gate sample | `acc_gate_memavailable_kib=1658352` ≥ `acc_gate_required_kib=1228800` ⇒ `acc_gate=pass` |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit readback | `Type=exec`, `RuntimeMaxUSec=120000000`, memory/swap/tasks as expected; `acc_capture_ok=yes` |
| memory.peak | `69054464` B = 65.8 MiB (`memory.current` at exit `35934208`) |
| pids.peak | `20` of `32` |
| memory.events.local | all zeros — no throttling, no OOM |
| wall time | `acc_workload_wall_ms=886`; journal CPU `371 ms`; service deactivated successfully |
| hashes before/after | `hash_status=identical`; both `.err` files empty |
| acceptance exit | `0` |

The runner printed no `✖` at all. The corrected test is present and green:

```
✔ the fixture restates exactly the 22 canonical (case, assertion) pairs, nothing more (0.3ms)
```

No preflight refusal occurred and nothing was retried, polled or escalated. The
first run directory is untouched.

Unit state after the run (read-only inspection): `systemctl show …-376214.service`
⇒ `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`; the
`admission-loader-unit-*` list is empty and no process matches the unit name.

## 6. Hash comparison with the first run

Same 17-file hash set, but the inputs are **not** identical across the two runs.
Exactly one file differs, and it is the file that was deliberately edited:

| file | first run | recheck | actual |
|---|---|---|---|
| `tests/scenarios-contract.test.mjs` | `6a35cf13…a6ede5` | `fd15b6f3…fe2858` | **differs** — the corrected assertion |
| `tests/evaluate.test.mjs` | `8a492801…5ff60f` | `8a492801…5ff60f` | identical |
| `run.sh` | `fa76355a…65b5` | `fa76355a…65b5` | identical — runner unchanged |
| `payload.sh` | `a9efd7bb…bffc` | `a9efd7bb…bffc` | identical — runner unchanged |
| the other 13 selected inputs | first run's record | same | identical — none edited |

A full `diff` of the two `hashes-before.txt` files yields exactly one changed line,
the one above. So this is **not** "same inputs, different outcome": the outcome
changed because one test's expectation was corrected, and every other hashed input
is byte-identical. The runner itself is provably the same binary text in both runs.

## 7. What this recheck will not claim

- Not real Loader acceptance. Unit contract tests over injected dependencies; the
  scenarios run against **mock ports**, and no Loader, Cordis fiber, host, plugin
  runtime or browser is launched.
- Not proof that the earlier failure is gone in general — one sample of one
  corrected assertion.
- Not a dependency-closure proof: 17 hashed files are targets, runner scripts, and
  one hop of imports; node builtins are excluded.
- Not a re-baseline of the first run. That run's 85/86 stands as measured, and the
  difference between the runs is the disclosed test edit, not a difference in what
  was observed.

## 8. Gate, and what happened

The Lead authorised exactly one recheck. It ran once, and its outcome is recorded
above: **86/86 pass, node exit 0, hashes identical, unit inactive**.

Nothing further is attempted. There is no third run, no cleanup of either run
directory, and no edit to any source in response to this result. A future reader
should treat the two runs as a pair:

- `20261103T195456Z-admission-loader-unit-375881-2592` — 85/86, one failing
  assertion, a defect in the check rather than in the fixture.
- `20261103T200108Z-admission-loader-unit-376214-24737` — 86/86, the same unit with
  that assertion corrected, every other hashed input byte-identical.

The green result is scoped by §7: it is a unit contract result over mock ports, not
Loader evidence, not a closure proof, and not a statement about any case these two
files do not exercise.
