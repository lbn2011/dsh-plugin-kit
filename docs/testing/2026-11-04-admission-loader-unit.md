# admission-loader-fixture unit slice — ONE bounded unit (2026-11-04)

**Status: RUN ONCE. 86 tests, 85 pass, 1 fail. Node exited 1. The slice is NOT
green, and nothing was rerun, fixed or retried.**

*Addendum (2026-11-04, after the run):* the single failure has since been diagnosed
**by the Lead from source**, and the test's own uniqueness assertion — not the
fixture's catalogue — was found wrong. §6.3 records that diagnosis with attribution.
The measured result in §6 is unchanged: this run reported 85/86, and no second run
has happened. A corrective edit now exists in the test file; it is **written, never
executed**.

The rule that shaped this document: the sections below were written *before* the
attempt, and they state exactly what would be executed, exactly once, and what
would not be. They are filled in only from that single launch's own artifacts.
**One attempt. No fix. No rerun.** Nothing in this file was pre-filled.

Two reporting notes, stated up front:

- The agent's turn ended with a raw `rc=1` / `hash_status=identical` line and no
  narrative. That is an **interruption in reporting**, not a diagnosis. The failure
  recorded below was read afterwards, from the run's own log.
- The failing assertion is a **declared-count mismatch inside the collector's own
  contract test**, not an observation of the admission loop. It does **not** say the
  evaluator is wrong. Whether the number 22 or the number 21 was the correct
  expectation is answered in §6.3: **neither id is missing from the fixture**.

## 1. Authority and role of this record

This is an **independent unit regression** over the `admission-loader-fixture`
slice. It runs on the collector/evaluator side only.

- No real Loader, no Cordis fiber, no arm, no host, no plugin runtime, no browser.
- No install, no build, no `npm`, no network, no production modification.
- No edit of `runtime/`, no edit of any test under review, no edit of any other
  report.
- The **only** intended writes are the new runner directory
  `experiments/acceptance/admission-loader-unit/` and, on a real run, its own
  `runs/<run-id>/` subtree.

Tests that use injected doubles are reported as *unit contract tests*, never as
Loader evidence.

## 2. Run identity (read back from the launch)

| field | value |
|---|---|
| prepared (local) | 2026-11-04, before launch |
| launched (UTC) | `2026-11-03T19:54:56Z` (run id stamp) |
| run id | `20261103T195456Z-admission-loader-unit-375881-2592` |
| unit | `admission-loader-unit-20261103T195456Z-375881` |
| repo HEAD | `effb9581687f995841d872304e03627473039957` |
| working tree | `experiments/acceptance/admission-loader-unit/` and `experiments/admission-loader-fixture/` are untracked (`??`) in this checkout |
| node | `/www/server/nodejs/v24.21.0/bin/node` — path only, **not** probed with `--version` |
| bwrap | `/usr/bin/bwrap` |
| preflight MemAvailable | 1790964 kB — survey only, **not** the gate; the gate was the single in-unit sample below |
| competing workers | checked absent before launch: no `admission*`/`acceptance*` units active, load `0.77`, only the harness's own `dsh web` + `billion-context` node processes |
| stale transient units | matched on `admission-loader-unit-*`; the pre-launch query returned none |

The availability gate was **not** evaluated outside the unit. It was evaluated
exactly once, inside, by the payload, with a single `MemAvailable` sample.

## 3. The single invocation (actual argv)

One `systemd-run` unit, `Type=exec`, launched once with `--wait --pipe --collect`:

```
systemd-run --wait --pipe --collect --unit=admission-loader-unit-20261103T195456Z-375881
  --property=Type=exec --property=MemoryMax=768M --property=MemorySwapMax=0
  --property=TasksMax=32 --property=RuntimeMaxSec=120 --property=CPUQuota=50%
  --property=WorkingDirectory=/root/dsh-ecosystem-spec/experiments/acceptance/admission-loader-unit
  -- /bin/bash .../admission-loader-unit/payload.sh admission-loader-unit-20261103T195456Z-375881
```

Inside the unit, after a successful envelope readback and capacity gate, exactly one
workload ran:

```
bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp \
      --unshare-pid --unshare-net --unshare-ipc --unshare-uts --die-with-parent \
      --chdir /root/dsh-ecosystem-spec \
  env -i PATH=/www/server/nodejs/v24.21.0/bin:/usr/bin:/bin HOME=/tmp TMPDIR=/tmp \
         NODE_OPTIONS=--max-old-space-size=384 \
  node --test --test-concurrency=1 <target-1> <target-2>
```

`acc_workload_started=yes` was printed once; there was one launch and no second
invocation of any kind.

## 4. The two literal targets

```
/root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/evaluate.test.mjs
/root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs
```

Two files, literal, no glob. There is no third target and no discovery.

## 5. Envelope and sandbox (prepared, and matched at readback)

- `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`, `CPUQuota=50%`,
  `RuntimeMaxSec=120`, `Type=exec`.
- Expected in-unit readback: `memory.max=805306368`, `swap.max=0`, `pids.max=32`,
  `cpu.max="50000 100000"`, `Type=exec`, `RuntimeMaxUSec=120000000` µs. Any
  mismatch stops the workload with exit 70 and no test result. **Every one of these
  matched** (`acc_capture_ok=yes`), so the workload was reached.
- One `MemAvailable >= 1200 MiB` sample, no polling. Observed once.
- Read-only root, private pid/net/ipc/uts namespaces, throwaway `/tmp`, `env -i`,
  heap capped at 384 MiB.

## 6. Captured evidence (read from the run's own files)

Run directory:
`/root/dsh-ecosystem-spec/experiments/acceptance/admission-loader-unit/runs/20261103T195456Z-admission-loader-unit-375881-2592/`

Files actually present: `argv.txt` (2318 B), `hashes-before.txt` (2511 B),
`hashes-after.txt` (2511 B), `hashes-before.err` (0 B), `hashes-after.err` (0 B),
`unit.log` (10549 B), `systemd-run.rc` (2 B), `journal.txt` (727 B),
`status.txt` (166 B). No `hashes-diff.txt` — none was written, because nothing
differed.

| field | actual value |
|---|---|
| systemd-run exit | `1` (`systemd-run.rc`, `status.txt: systemd_run_rc=1`) |
| unit exit / node exit | `acc_node_rc=1`; journal: `Main process exited, code=exited, status=1/FAILURE`, `result 'exit-code'` |
| tests / pass / fail / skipped / todo | `86 / 85 / 1 / 0 / 0`, suites `9`, duration `475.1 ms` |
| gate sample | `acc_gate_memavailable_kib=1740736` ≥ `acc_gate_required_kib=1228800` ⇒ `acc_gate=pass` |
| cgroup readback | `memory.max=805306368`, `swap.max=0`, `pids.max=32`, `cpu.max="50000 100000"` |
| unit readback | `Type=exec`, `RuntimeMaxUSec=120000000`, memory/swap/tasks all as expected; `acc_capture_ok=yes` |
| memory.peak | `68399104` B = 65.2 MiB (cgroup `memory.peak`; `memory.current` at exit `32481280`) |
| pids.peak | `20` of `32` allowed |
| memory.events.local | `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0` — no throttling, no OOM |
| wall time | `acc_workload_wall_ms=888`; service runtime `970 ms`; CPU `382 ms` |
| hashes before/after | `hash_status=identical` — all 17 files byte-identical, both `.err` files empty |
| acceptance exit | `1` (`status.txt: acceptance_exit=1`) |

`acc_runtime_usec_numeric=<unavailable>` appears in the log; the resolved
`acc_runtime_usec_resolved=120000000` matched the expectation, so this was a
naming artefact of that readback path, not a mismatch.

### 6.1 The one failure, exactly as reported

```
test at experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs:160:1
✖ the fixture restates exactly the 22 canonical assertion ids, nothing more
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  21 !== 22
      at TestContext.<anonymous>
      (file:///root/dsh-ecosystem-spec/experiments/admission-loader-fixture/tests/scenarios-contract.test.mjs:167:10)
    actual: 21, expected: 22
```

Everything else in that file passed, including the cases named
`a case begun but never assembled refuses; it is never relabelled not-run`,
`an apply that failed refuses, even when the teardown drained`, and
`the drain must attempt every entry and must never rewrite the apply status`.

Interpretation, kept to what the log supports: the fixture's own restatement of the
canonical assertion catalogue lists **21** ids where the test asserts **22**. The
test therefore reports a count disagreement between two lists inside the fixture.
It is not evidence that any assertion verdict produced by the evaluator is wrong,
and this run does not establish which side is missing an id.

### 6.2 The other target

`evaluate.test.mjs` contributes the remaining cases and shows no failure: every
`evaluateObservations` suite in `unit.log` is marked `✔` (evaluated, boundary
witness, incomplete observation, malformed input, unattempted cases, cleanup source
justification, and the projector/diagnostician chain). Its 85 passing cases include
the real-chain test that injects the three production modules.

### 6.3 Diagnosis of that failure, attributed

**Attribution: diagnosed by the Lead from source** (`spec/admission-evidence.md`
§6.2, lines 568–628), after the run. It was not inferred from the run's log, and the
log alone could not have produced it. **Nothing in §6, §6.1 or §6.2 above is
retracted by this subsection** — those numbers are what the single launch reported.

The finding, in the Lead's terms:

- The spec defines **7 + 5 + 5 + 5 = 22** case/assertion **pairs**.
- `disposer-ran-exactly-once` is specified for **both** `admission-admitted` and
  `admission-cleanup-failure`. So the 22 pairs carry only **21 globally unique
  names**.
- The per-case comparisons in `tests/scenarios-contract.test.mjs:160-167` were
  therefore right, and so was the total of 22. The wrong assertion was the **global
  `Set.size` check demanding 22 unique names**, which a legitimately shared name
  cannot satisfy.

Consequently: **no canonical id is missing from the fixture.** The fixture restated
all 22 pairs correctly; the test asked a question the spec never promised — that
every assertion *name* be globally unique. The failure was a defect in the check,
not a gap in the catalogue and not an evaluator result.

Corrective edit applied to the test file, **CODE ONLY, not executed**:

- The test is retitled to `…exactly the 22 canonical (case, assertion) pairs…`.
- Assertions kept: both per-case deep-equals against `CANONICAL` for every case.
- Assertions added: per-case uniqueness of ids within a case; `pairs.length === 22`;
  `new Set(pairs).size === 22` over `caseId::assertionId`; `names.length === 22`;
  `new Set(names).size === 21`.
- Shared-name regression, pinned explicitly: the only name occurring more than once
  is `disposer-ran-exactly-once` (`deepEqual(shared, ['disposer-ran-exactly-once'])`).
  `rollback-disposer-ran-exactly-once` is a different id and is unaffected.
- No production, schema, or evaluator file was touched, and nothing was run.

Because that edit is unexecuted, the slice's measured status stays **85/86, node
exit 1**. The edit is expected to make this one test pass; expectation is not
evidence, and only a future authorised run could show it.

## 7. What this record will not claim

- Not real Loader acceptance. Unit contract tests only.
- Not proof of realLoader lifecycle behaviour, of the coordinator under a real
  plugin, or of anything the two files do not exercise.
- Not proof that the proposed runtime-contract semantics are right; at most that
  these written contracts hold for these fixtures.
- **Not a green slice.** 85 of 86 passed; one failed; node exited 1.
- **Not a diagnosis.** No test source, runner or evaluator code was changed, and
  nothing was rerun to see whether the failure is stable. A single observation of a
  failing count is one sample.
- **Not a dependency-closure proof.** The 17 hashed files are the two targets, the
  two runner scripts, and the targets' direct imports plus one hop. Node builtins
  are excluded. Bytes identical across those 17 files means *those files did not
  change*, never that the tests loaded nothing else.

### 7.1 What the stopped process did and did not establish

The launch is now finished: `systemctl show` on
`admission-loader-unit-20261103T195456Z-375881.service` returns
`LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, and no process
matches `admission-loader-unit`. That confirms **this unit is gone**; it is not a
statement about anything else on the machine.

The absence of a `runs/` directory earlier in this record's life proved nothing, and
is now moot — a run directory exists. File modification times remain not-byte-
identity and not provenance; contents were hashed for that reason.

### 7.2 Deviations from the prepared plan

- The prepared text said the outcome table would be filled "only from the single
  launch's own artifacts". It was: every number above comes from `unit.log`,
  `status.txt`, `journal.txt`, or the hash files.
- The agent's turn ended with a bare `rc=1` line. That is a reporting interruption;
  the failure was read from the log afterwards, still without any rerun.
- Before launch, the hash set was extended to include `run.sh` and `payload.sh`
  themselves, and the duplicate input list in `payload.sh` was removed so the set is
  claimed once.
- `git rev-parse HEAD` and `git status --porcelain` were run afterwards to fill §2.
  They are read-only inspections, not part of the measured workload.

## 8. Gate for anything further

This slice stays at **one attempt**. A rerun, a fix to either target, or a change to
the runner is a **new decision for the Lead**, not a continuation of this one:
reproducing the count mismatch would tell us whether it is stable, and inspecting
the two lists would tell us which id is absent — but both are work this turn was
explicitly forbidden to do.

Formal execution of any further attempt waits for that explicit GO. `run.sh` was
invoked exactly once, and its one run directory stands as written.
