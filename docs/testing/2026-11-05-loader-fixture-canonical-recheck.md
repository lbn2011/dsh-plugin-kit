# Loader-fixture unit re-run after the canonical-path correction (STATUS: RAN ONCE, PASSED)

**Date:** 2026-11-05
**Slice:** `experiments/third-party-pilots/loader-fixture-unit/`
**Subject of the run:** the *pure gate tests* of both `*-loader/fixture.test.mjs` files,
including the corrected `assertResolutionContract` (canonical `fs.realpath` identity).
**Not Loader evidence.** No host was booted, no plugin was mounted, no tool was
registered or executed, no socket was opened.

## 1. Authorisation and how the single-use gate was handled

One run of the **existing, unmodified** entry point was authorised:

```
bash experiments/third-party-pilots/loader-fixture-unit/run.sh unit
```

`run.sh` and `payload.sh` were **not** modified for this round; the two literal test
files remain the only workload. The gate file `GO-unit.txt` was already spent
(it still held `GO unit` plus the previous round's consumption line), so it was
handled without moving, deleting or clobbering anything:

1. `GO-unit.txt` was read with the file tools (2 lines).
2. Its exact content was written to a brand-new file
   `GO-unit.history.20261105T152540Z.txt` (did not exist before) and read back — 2
   lines, identical text.
3. Only then was `GO-unit.txt` replaced in place with the strict single line `GO unit`
   and read back (1 line) before execution.
4. After the run, the consumption line was appended (see §7).

## 2. Run identity

| Item | Value |
| --- | --- |
| run dir | `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T152657Z-lfx-unit-441467-24262/` |
| systemd unit | `lfx-third-party-unit-20261105T152657Z-441467` |
| mode | `unit` (exactly one mode; no chaining, no retry) |
| launcher output | `lfx_overall_rc=0`, `launcher_exit=0` |
| command | `node --max-old-space-size=384 --test --test-concurrency=1 <toolkit test> <harbor test>` |

## 3. Actual counts (as reported by the workload)

`unit.log`:

```
ℹ tests 57
ℹ suites 0
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 470.500162
Finished with result: success
Main processes terminated with: code=exited, status=0/SUCCESS
Service runtime: 861ms
CPU time consumed: 367ms
Memory peak: 64.3M (swap: 0B)
```

The 57 are the Harbor file's 33 plus the Toolkit file's 24 (the previous round had
53 = 33 + 20; four contract cases were added by the correction). The 24 Toolkit
cases include the four new ones:

- `contract accepts a packageDir that is a symlink to the pinned directory` ✔
- `contract refuses a symlink whose target is another directory` ✔
- `contract refuses a packageDir that cannot be resolved` ✔
- `contract refuses a missing, empty or relative packageDir` ✔

The eleven pre-existing contract cases (`contract passes…`, `…missing`,
`…non-installation scope`, `…another directory`, `…not a linked root`,
`…lookalike linked-root name`, `…linked root pointing at another tree`,
`…non-object resolution`, and the mount/disable gates) also passed.

## 4. Exit codes: raw and interpreted

| Evidence | Value |
| --- | --- |
| `systemd-run.rc` | `0` |
| `sandbox_invocation_rc` (`node-exit-code.txt`) | `0` |
| `unit_rc` (verdict) | `0` |
| `hash_rc` / `hash_status` | `0` / `identical` |
| `overall_rc` / launcher | `0` / `0` |
| `loader-fixture-status.txt` | `result=pass`, `work_rc=0`, `workload_verdict=pass` |
| `node_status` | `node_0_interpreted_as_all_tests_passed_source_unverified` |

Per the runner's own manifest, these codes are **interpretations of one bwrap exit
status** (`source_attribution=not_distinguished_between_bwrap_setup_and_node_workload`,
`node_start_not_independently_proven=yes`). A `0` here does not prove that node
started as such; it is consistent with the counts in §3 being real, which come from
`unit.log`, not from the exit code.

## 5. Caps and gate (read back inside the unit)

From `loader-fixture-manifest.txt`:

```
cgroup_memory_max=805306368
cgroup_memory_swap_max=0
cgroup_pids_max=32
cgroup_cpu_max=50000 100000
cgroup_proof=yes
unit_runtime_max_raw=2min
unit_runtime_max_normalized_usec=120000000
unit_memory_max=805306368
unit_tasks_max=32
unit_proof=yes
memavailable_gate_kib=1444880 required_kib=1228800 sampled_by=launcher_once
preconditions=ok
```

Sandbox: `env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`, `--ro-bind / /`,
one persistent writable bind (the run's `out/`), `--tmpfs /tmp`, `--dev /dev`,
`--proc /proc`, `--unshare-pid/-ipc/-uts/-net`, `--die-with-parent`. The run
directory itself is not writable inside the sandbox. `route`s are **not**
independently verified.

## 6. Input-hash scope, and what changed since the 53/53 round

Scope (as the runner declares it): **6 fixed named files only — not a closure, not a
tree walk; `node_modules` never traversed.** Before and after are byte-identical
(`hash_status=identical`):

| File | sha256 (both before and after) | vs previous round |
| --- | --- | --- |
| `loader-fixture-unit/run.sh` | `dd793eed41378bf4ea471c8c5141e08fcc4a98b493b7144f78724959d34615dd` | unchanged |
| `loader-fixture-unit/payload.sh` | `06f7d8681b93f93073f38939412c99e4bb392ea43dc4ea65b615c44d5d7a32c4` | unchanged |
| `toolkit-loader/fixture.test.mjs` | `f6b5805d3b798127793a1688fc231e0a49545dd2372b008e912ce592c4aeaa60` | **changed** (was `1ba63ea3…`) |
| `toolkit-loader/fixture.mjs` | `856a8bd58a8e322ceccd4c250dcb3a216f517385ee0f2f5620882ca5c7f4bbd9` | **changed** (was `1c23145f…`) |
| `harbor-loader/fixture.test.mjs` | `79e9c2b07ff0e27066a94a5f145284eb2fdeb25e4815b2eafa424df4a9f753fd` | unchanged |
| `harbor-loader/fixture.mjs` | `e9df8c1e1bee20a6a5d6bc18e9735dc1ee5cd5d022400a159fe896f34db9b578` | unchanged |

So this round differs from the 53/53 round in exactly the two Toolkit fixture files,
and the count moved 53 → 57 because four contract cases were added. Nothing else in
the workload changed.

## 7. Terminal state and cleanup

`unit-cleanup.txt` and `verdict.txt`:

```
before_stop load=not-found active=inactive sub=dead main_pid=0 terminal_state=not_found_loadstate_mainpid0
cleanup_action=skipped_already_terminal load_state=not-found active_state=inactive reset_failed=not_attempted_by_design
after load=not-found active=inactive sub=dead main_pid=0 after_state=not_found_loadstate_mainpid0 after_terminal_confirmed=yes
unit_unload_guaranteed=no
```

`unit-scan.txt` is empty (no `lfx-*`/`tkb-*`/`rbk-*`/`hbl-*`/`harbor-*`/`cpy-*`/
`exc-*`/`acq-*`/`p0-*`/`acc-*`/`admission-*` unit left behind). `stop` and
`reset-failed` were deliberately not called; the unit had already been collected.
`unit-props.txt` is a **post-hoc snapshot** and is not used as envelope evidence;
the envelope evidence is the in-unit read-back in §5.

The gate was re-closed after the run:

```
GO unit
consumed=yes run_id=20261105T152657Z-lfx-unit-441467-24262 overall_rc=0 reason=pass single_use_authorization_spent=yes runner_summary=node_tests_57_pass_57_fail_0 skipped_0 previous_run=20261105T140409Z-lfx-unit-439433-30899 previous_consumed_backup=GO-unit.history.20261105T152540Z.txt
```

## 8. Why the temporary filesystems matter here

The four new contract cases cannot be satisfied by pure in-memory mocks: the
correction decides identity with `fs.realpath`, so the tests must give it **real**
directories and **real** symlinks. They therefore build a throwaway tree with
`mkdtemp` under `os.tmpdir()` (three directories, two symlinks) and take
`realpath` of it. `HOME`/`TMPDIR` are `/tmp` inside a `tmpfs`, so that tree lives in
the sandbox's ephemeral filesystem and disappears with the unit.

That is real filesystem behaviour — not a mock — but it is still only the **test's**
tree. It proves the gate distinguishes "same directory, different spelling" from
"different directory"; it proves nothing about the pinned checkout, whose real
`@deepseek-ai/dsh-tools` entry has still never been passed through the corrected
gate.

## 9. Evidence boundaries — what this run does and does not support

**Supports:**

- On this host and this checkout, with the six pinned inputs above, the two pure-gate
  test files pass 57/57, including the corrected canonical-path contract and its
  four new regressions.
- The unit really ran inside the stated envelope (cgroup and unit properties read
  back inside the unit), the memory gate was sampled once by the launcher and
  passed, the network was unshared, and the sandbox had exactly one persistent
  writable bind.
- The six inputs were byte-identical before and after, so the result is attributable
  to those bytes.

**Does not support:**

- **No Loader evidence.** `no_loader_boot=yes no_plugin_mount=yes
  no_tool_execution=yes no_host_service=yes no_socket=yes` per the manifest. Nothing
  here shows that the Toolkit mounts, that ten tools appear, that disable/re-enable
  works, or that teardown removes registrations.
- No evidence about the pinned checkout's real resolution entry: the "symlink to the
  pin" case uses a test-owned symlink, not
  `…/agent-instructions/node_modules/@deepseek-ai/dsh-tools`.
- `toolkit-loader` is still **CODE CHANGED, NOT RE-RUN**: its own single-use gate
  remains spent and no Loader run has occurred since the correction.
- The 6-file hash set is **not** a closure; `node_modules` and transitive
  dependencies are outside it.
- Exit codes are interpretations of one bwrap status (see §4); the counts in §3 are
  the actual measurement.

## 10. Provenance and deviations

- Evidence gathered with the file tools only: `unit.log`, `verdict.txt`,
  `loader-fixture-manifest.txt`, `loader-fixture-status.txt`, `gate.txt`,
  `hashes-before.txt`, `hashes-after.txt`, `unit-cleanup.txt`, `systemd-run.rc`,
  `node-exit-code.txt`. No extra shell probes, no `bash -n`, no re-run, no retry,
  no limit increases, no install, no build, no Loader.
- The single command executed was the authorised `run.sh unit`.
- Deviation, disclosed: the instruction described the gate as possibly
  "already consumed"; it was in fact consumed, and the backup-then-rewrite sequence
  in §1 is the deviation-free way it was handled. No prior record was moved or
  deleted.
- All earlier records remain untouched: the 42/2/1 failed round, the 45/0/1 round,
  the 46/0/0 round, the 53/53 round and the loader-fixture-unit failure at `72` are
  preserved as written; this file adds a new, separate round.
- Harbor received **no** separate run; it appears here only as the second literal
  test file inside the authorised unit.
