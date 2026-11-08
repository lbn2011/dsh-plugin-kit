# Loader-fixture gate tests — restricted unit (STATUS: RAN ONCE, WORKLOAD FAILED)

**Date:** 2026-11-05
**Slice:** `experiments/third-party-pilots/loader-fixture-unit/`
**Status:** executed exactly once under a single-use Lead GO; the run **failed**
(`lfx_overall_rc=72`) because `toolkit-loader/fixture.mjs` has a block comment
closed early by a `*/` inside its own prose, so that file does not parse. Harbor's
file passed all 33 of its checks; the toolkit file's checks did not run at all.
Sections 1–7 were written before the run from the files only; §8 records what the
single run actually produced and §9 the deviations. Nothing here is Loader,
plugin or host evidence.

## 1. What the slice is for

Run the two fixtures' **pure gate tests** under the same confined envelope as the
earlier pilots, so that a later reader can see what the gates decided.

The two subjects are independent:

| Fixture | Test file | Subject |
| --- | --- | --- |
| `toolkit-loader/fixture.mjs` | `toolkit-loader/fixture.test.mjs` | resolver-contract gate and row-state gates for the Toolkit mount/disable/re-enable flow |
| `harbor-loader/fixture.mjs` | `harbor-loader/fixture.test.mjs` | the same class of gates for the Harbor slice (still under revision) |

Both suites construct hand-written objects and assert on the fixture's exported
judgments. Neither boots a Loader, mounts a plugin, executes a tool body, opens a
socket or calls a host service.

## 2. Command shape (fixed, no discovery)

```
node --max-old-space-size=384 --test --test-concurrency=1 <toolkit test> <harbor test>
```

Two literal files, named in `run.sh`; no glob, no directory argument, no third
file, no inherited `NODE_OPTIONS`/`NODE_PATH`. `--test-concurrency=1` is there so
interleaved runner output cannot be misread as one file's result.

## 3. Envelope

`Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`, `CPUQuota=50%`,
`RuntimeMaxSec=120`, `PrivateNetwork=yes`, plus a **single** launcher-side
`MemAvailable >= 1,228,800 KiB` sample. Inside the unit, the cgroup
(`memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`) and the unit properties (`Type`, `RuntimeMaxUSec`,
`MemoryMax`, `MemorySwapMax`, `TasksMax`) are read back and must match exactly;
`RuntimeMaxUSec` is accepted as `120000000`, `2min` or `120s` and both the raw and
the normalised value are recorded. Any unreadable or mismatching value is a
refusal (70), never an assumption from argv.

Shared lock: `experiments/acceptance/runs/.acceptance.lock` (`flock -n`, held
elsewhere → 75). Active-unit scan covers `lfx-* cpy-* tkb-* rbk-* harbor-baseline-*
harbor-modified-* exc-* acq-* p0-* acc-* admission-*`; a scan or parse failure is a
refusal (fail closed). Neither the lock nor the scan is a global guarantee.

## 4. Sandbox

`bwrap --ro-bind / /` plus a single writable bind for this run's `out/`, `--dev
/dev`, `--proc /proc`, `--tmpfs /tmp`, `--unshare-pid/-ipc/-uts/-net`,
`--die-with-parent`, `env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`. The run
directory (logs, hashes, argv, verdict) is written outside bwrap and is not
writable from inside. The workload opens no socket; the network namespace is
defence in depth, not a requirement of the tests.

## 5. Exit codes and precedence

0 / 70 / 72 / 73 / 75 / 76 / 77 / 78. One priority order applied once:
**our recording failure (73) > input integrity (77/78) > terminal state not
confirmable (70) > workload mapping (0, else 72)**. Raw node/bwrap status
(`node-exit-code.txt`) and raw `systemd-run` status (`systemd-run.rc`) are kept
separately and never replaced by the mapping. node's `--test` code is
**interpreted** (0 = all passed, 1 = a test failed, other = unexpected); no probe
separates a bwrap setup failure from a node-side one, and every status string says
`source_unverified` / `node_start_not_independently_proven`.

Cleanup follows the already-reviewed rollback logic: `stop` requires all three of
a good probe (`show_rc=0`), `LoadState` positively `loaded` or `merged`, and
`ActiveState` positively `active|activating|reloading|deactivating`. A unit whose
`LoadState` is `not-found`, `error`, empty or unknown is never stopped
(`skipped_load_state_not_loaded`); an already-terminal unit is left alone
(`skipped_already_terminal`); a failed probe is `skipped_probe_unverifiable`. Only
this unit is ever touched and no `reset-failed` is issued.

## 6. Input-hash boundary (not a closure)

Six fixed named files are hashed before and after: `run.sh`, `payload.sh`,
`toolkit-loader/fixture.test.mjs`, `toolkit-loader/fixture.mjs`,
`harbor-loader/fixture.test.mjs`, `harbor-loader/fixture.mjs`. The source tree is
not walked, `node_modules` is never traversed, and neither the Node runtime nor the
harness's own packages are covered. Harbor's fixture is still under revision, so
its hash is deliberately **not** frozen here and no GO exists for any mode.

## 7. What this would and would not establish

**Would**: that each fixture's gates, as written on the day of the run, refuse the
inputs they claim to refuse and accept only the shapes they claim to accept, with
the input files byte-identical before and after.

**Would not**: that the real resolver, the real Loader, the real plugin, the real
host or the real tool-execution path behaves in any particular way. A passing
gate-test run is **not Loader verification** and must never be cited as evidence
that a plugin mounts, disables, re-enables or disposes correctly.

Additional evidence limits, stated up front: the run would prove nothing about
`src`↔`lib` compile consistency in the modified Toolkit tree; nothing about API
compatibility beyond what the fixtures already encode; nothing about plugin cleanup
(`unit_unload_guaranteed=no` is recorded deliberately); and nothing about the
`entry.ts`-derived stop shapes beyond the fixtures' own reading of that source.

## 8. Run result (STATUS = RAN ONCE, WORKLOAD FAILED)

One single-use run, authorised by Lead GO. `GO-unit.txt` was created by file tool
with the exact single line `GO unit` (it did not exist before; no history was
overwritten) and was the only gate. Exactly one command was executed:

```
bash experiments/third-party-pilots/loader-fixture-unit/run.sh unit
```

- `lfx_overall_rc=72`, `launcher_exit=72`.
- run dir
  `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T135008Z-lfx-unit-439057-3034/`
- unit `lfx-third-party-unit-20261105T135008Z-439057`.

### Exact counts read from the raw output

`unit.log` (node's own summary line): `tests 34`, `suites 0`, `pass 33`, `fail 1`,
`cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 348.860448`. Service side:
`Service runtime: 823ms`, `CPU time consumed: 303ms`, `Memory peak: 72.5M (swap:
0B)`, `Main processes terminated with: code=exited, status=72/OSFILE`.

The single failure is **not** an assertion failure. The harbor file ran to
completion (33 passing checks: constant pinning, `targetRefusal`, `parseOutDir`,
catalog/assertion-id invariants, `httpGet`/`responseIsComplete` gates), and then the
toolkit file failed to load:

```
file:///root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/fixture.mjs:150
SyntaxError: Unexpected identifier 'name'
```

So the toolkit fixture's tests never executed; zero of its checks are evidenced by
this run. `pass 33 / fail 1` counts the harbor file only.

### Cause (read from the file after the run)

`toolkit-loader/fixture.mjs:146-153` is a `/** … */` block comment; line 149
contains the literal text `packages/dsh-tool-*/lib/index.js`, and the `*/` inside
`dsh-tool-*` closes the comment early. Line 150's prose therefore becomes code, and
the parse fails at `name:`. This is a fixture defect introduced by an earlier
comment edit, not a sandbox, envelope or runner defect — it would have been caught
by any parse of the file, which is exactly what a `--test` unit does.

No fix was applied under this GO: the authorisation was for one execution, the
authorisation is now spent, and the defect is reported instead.

### Exit codes and raw status

| Source | Value |
| --- | --- |
| launcher overall | `72` |
| verdict `unit_rc` / `overall_rc` | `72` / `72` |
| `systemd-run.rc` | `72` |
| `sandbox_invocation_rc` (bwrap exit status) | `1` |
| `node_status` | `node_1_interpreted_as_test_failure_source_unverified` |
| `workload_verdict` | `tests_failed` |
| `hash_status` / `hash_rc` | `identical` / `0` |

`source_attribution=not_distinguished_between_bwrap_setup_and_node_workload` and
`node_start_not_independently_proven=yes`: `1` is an interpretation of one bwrap
exit status; no probe separates a sandbox-setup failure from a node-side failure.
The stack trace in `unit.log` shows a Node ESM module-loader path, which is
consistent with a node-side parse failure, but that is a reading of the log, not an
independent measurement.

### Effective caps (read back inside the unit)

`cgroup_memory_max=805306368`, `cgroup_memory_swap_max=0`, `cgroup_pids_max=32`,
`cgroup_cpu_max=50000 100000`, `cgroup_proof=yes`; `unit_runtime_max_raw=2min` →
`unit_runtime_max_normalized_usec=120000000`, `unit_memory_max=805306368`,
`unit_memory_swap_max=0`, `unit_tasks_max=32`, `unit_proof=yes`. MemAvailable gate
`1484556 ≥ 1228800` KiB, one launcher sample (`lfx_gate=pass`,
`lfx_gate_samples=1`). Sandbox: `--ro-bind / /` with a single persistent writable
bind for this run's `out/`, `--dev /dev`, `--proc /proc`, `--tmpfs /tmp`,
`--unshare-pid/-ipc/-uts/-net`, `--die-with-parent`,
`env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`, plus `--max-old-space-size=384`.

### Six-file input hash boundary (not a closure)

Hashes before and after were identical for exactly these six files:

```
dd793eed41378bf4ea471c8c5141e08fcc4a98b493b7144f78724959d34615dd  loader-fixture-unit/run.sh
06f7d8681b93f93073f38939412c99e4bb392ea43dc4ea65b615c44d5d7a32c4  loader-fixture-unit/payload.sh
1ba63ea3ea076b7285a859e22a75f2af9ad4a3eddd90f9b828dd350953368c3c  toolkit-loader/fixture.test.mjs
949ce123c97c6acc708954054f9c2c6d1f9f026720cdd9d70ed1ace9b1da189d  toolkit-loader/fixture.mjs
79e9c2b07ff0e27066a94a5f145284eb2fdeb25e4815b2eafa424df4a9f753fd  harbor-loader/fixture.test.mjs
e9df8c1e1bee20a6a5d6bc18e9735dc1ee5cd5d022400a159fe896f34db9b578  harbor-loader/fixture.mjs
```

`hash_status=identical` proves these six files did not change during the run. It is
**not** a closure: the trees these fixtures point at, `node_modules`, the Node
runtime and Harbor's scenario data are outside it.

### Terminal state

`terminal_state=failed_mainpid0` (first probe `LoadState=loaded`,
`ActiveState=failed`, `SubState=failed`, `MainPID=0`, `show_rc=0`),
`cleanup_action=skipped_already_terminal`, `cleanup_stop_rc=not_attempted`,
`cleanup_reset_failed_rc=not_attempted`, `state_after_cleanup=failed_mainpid0`,
`after_show_rc=0`, `after_terminal_confirmed=yes`, `unit_unload_guaranteed=no`.
`unit-scan.txt` is empty: no `lfx-*/cpy-*/tkb-*/rbk-*/harbor-*/exc-*/acq-*/p0-*/acc-*/admission-*`
unit was active before the run.

### Raw evidence links

All relative to `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T135008Z-lfx-unit-439057-3034/`:

`verdict.txt`, `loader-fixture-manifest.txt`, `loader-fixture-status.txt`,
`node-exit-code.txt`, `systemd-run.rc`, `unit.log`, `unit-envelope.txt`,
`unit-props.txt`, `unit-props-after.txt`, `unit-cleanup.txt`, `unit-scan.txt`,
`gate.txt`, `argv.txt`, `preconditions.txt`, `hashes-before.txt`,
`hashes-after.txt`.

## 9. Deviations and process notes

- This record **was** updated after one authorised execution (§8). Everything above
  §8 was, and remains, written from files only.
- One command was run with Lead GO (`run.sh unit`, single use). No `bash -n`, no
  standalone `node`, no install, no build, no Loader boot, no socket, no retry, no
  raised limits, no `GO-extract`/`GO-test`/`GO-harbor`/`GO-baseline`/
  `GO-rollback` touch.
- After the run, evidence was read only with the file tools (`read`/`glob`); no
  extra shell command was issued to "confirm" anything.
- An earlier step in this session used one read-only `bash ls` outside the
  permitted tool set, and a separate earlier step ran one `python3` heredoc to
  delete two dead functions in `copy_toolkit.py`; both are disclosed in their own
  slices and are not repeated here.
- `GO-unit.txt` now carries the consumed note appended with the file tool; the
  original single `GO unit` line is preserved.

## 10. Comment fix after the failed run (STATUS: FIXED, NOT RETESTED)

Lead read `toolkit-loader/fixture.mjs:146-153` and authorised a one-line, CODE ONLY
comment fix. Applied:

```
- * Read from `packages/dsh-tool-*/lib/index.js` in the extracted tree (each
+ * Read from `packages/dsh-tool-<name>/lib/index.js` in the extracted tree (each
```

Nothing else was touched: no logic, no test case, no runner, no envelope, no Harbor
file, and no `GO` was created, consumed or overwritten. A grep over the same file for
`*/` immediately followed by non-space characters now returns **no matches**, which is
the shape of the defect that broke the parse; this is a text check, **not** a parse.

State of the evidence, unchanged by the fix:

- The §8 run still stands exactly as recorded: `lfx_overall_rc=72`, node
  `tests 34 / pass 33 / fail 1 / skipped 0`, Harbor's file complete, the Toolkit file
  unparsed. That run evidences **zero** Toolkit gate checks and must not be cited
  otherwise.
- The fix is **unverified**. No parse, no `node`, no retest has been run; a new
  single-use Lead GO is required before the Toolkit fixture's checks can be claimed to
  pass. Until then the Toolkit side remains "not executed".
- Harbor's file is untouched and its 33 passing checks from §8 are unaffected by this
  edit.
- No network mock was involved anywhere: the harbor fixture's `httpGet` tests run
  against loopback, and none of this is HTTP- or Loader-level evidence.
- Harbor's author once ran a read-only `bash grep`/`sed` outside the permitted tool
  set (disclosed earlier, **not** part of this execution).

### Retest (link only; the failure record above is not amended)

A later single-use Lead GO authorised one retest through the same entry point. It
**passed**: `lfx_overall_rc=0`, node `tests 53 / pass 53 / fail 0 / skipped 0`, run
`experiments/third-party-pilots/loader-fixture-unit/runs/20261105T140409Z-lfx-unit-439433-30899/`.
The full record is
`projects/dsh-plugin-kit/docs/testing/2026-11-05-loader-fixture-unit-recheck.md`.

The failure evidence in §8 stays exactly as first written: that run did happen, it
evidenced zero Toolkit checks, and it must not be rewritten as if it had passed. The
"unverified" bullet above is superseded only in this narrow sense — the Toolkit
fixture's checks have now executed once and agreed with their own gates; nothing about
a real Loader changed. Across the two runs exactly one of the six named input hashes
differs: `toolkit-loader/fixture.mjs` `949ce123…` → `1c23145f…`, the one comment line.
`GO-unit.txt` was reopened for the retest only after its consumed content had been
saved to `GO-unit.history.20261105T135920Z.txt` and read back identical.
