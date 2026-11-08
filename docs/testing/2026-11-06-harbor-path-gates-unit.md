# Harbor path gates: kit gate-layer unit run (2026-11-06)

STATUS: **RAN ONCE — PASSED (83 / 83)**. Fifth run of this slice
(`72`, then `0` at 53, `0` at 57, `0` at 75, and this `0` at 83).

This is a gate-layer unit run of **pure judgments** from two fixture files. It is
**not** Loader evidence, **not** plugin evidence, **not** a real boot, and **not** a
real HTTP GET.

## 1. Authorization and GO handling

- One run of the existing `experiments/third-party-pilots/loader-fixture-unit/run.sh unit`,
  with the existing runner and both literal test files unchanged. No source, runner or
  test edit was made for this run; the four `hubPathGate`/`configuredNameGate`/`runScenario`
  assertions were added by the Lead beforehand.
- `GO-unit.txt` had already been consumed (2 lines). It was read first, then copied
  verbatim into a brand-new file `GO-unit.history.20261106T023200Z.txt` (created, never
  overwritten), read back and compared — 2 lines, identical — and only then was
  `GO-unit.txt` rewritten in place as the strict single line `GO unit` (1 line).
- After the run the consumption line below was appended, closing the gate again:

  ```
  GO unit
  consumed=yes run_id=20261105T183234Z-lfx-unit-446047-24852 overall_rc=0 reason=pass single_use_authorization_spent=yes runner_summary=node_tests_83_pass_83_fail_0 skipped_0 previous_run=20261105T174450Z-lfx-unit-444769-21668 previous_consumed_backup=GO-unit.history.20261106T023200Z.txt
  ```

## 2. Identity

| Item | Value |
| --- | --- |
| run id | `20261105T183234Z-lfx-unit-446047-24852` |
| unit | `lfx-third-party-unit-20261105T183234Z-446047` |
| run dir | `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/` |
| mode | `unit` (single mode, no chaining, no retry) |
| workload | `node --max-old-space-size=384 --test --test-concurrency=1 <two literal files>` |
| launcher rc | `lfx_overall_rc=0` |

## 3. Actual counts

`unit.log`:

```
ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 787.004073
Finished with result: success
```

Split by fixture, as listed in the log (log lines 2–42 Harbor, 43–84 Toolkit):

- **Harbor: 41 cases** — `constants` (1), `targetRefusal` (9), `parseOutDir` (5),
  `catalog`/`missingAssertions` (5), `httpGet` (13), `responseIsComplete` (1),
  `hubPathGate` (4), `configuredNameGate` (1), `runScenario` (3).
- **Toolkit: 42 cases** — `contract` (12), `mount gate` (3), `disable gate` (7),
  `overlay` (1), `parseArgs` (1), exemption site (7), `assertExemptionAbsent` (1),
  readback gate (4), mock grant (6).

Delta against the previous 75-case run (**Harbor 33 + Toolkit 42**): **+8, all in
Harbor** — the four `hubPathGate` cases, the `configuredNameGate` case and the three
`runScenario` no-boot/no-request cases. The Toolkit count is unchanged at 42; every
Toolkit group (`contract`, mount, disable, exemption site, readback, grant) has the
same size as before.

## 4. Exit codes

- `unit_rc=0`, `overall_rc=0`, `hash_status=identical`, `hash_rc=0`.
- `sandbox_invocation_rc=0`, `node_status=node_0_interpreted_as_all_tests_passed_source_unverified`,
  `workload_verdict=pass`, run status `result=pass`.
- `source_attribution=not_distinguished_between_bwrap_setup_and_node_workload`: those
  codes are interpretations of one bwrap exit status; no probe separates sandbox setup
  from the workload.
- `unit.log`: `Service runtime: 1.193s`, `CPU time consumed: 519ms`,
  `Memory peak: 69.2M (swap: 0B)`.

## 5. Envelope

- cgroup: `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
  `cpu.max=50000 100000`, `cgroup_proof=yes`.
- unit: `Type=exec`, `unit_runtime_max_raw=2min` → `120000000`,
  `unit_memory_max=805306368`, `unit_tasks_max=32`, `unit_proof=yes`.
- gate: `memavailable_gate_kib=1279996` ≥ `required_kib=1228800`, launcher sampled once.
- sandbox: `env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`; `bwrap --ro-bind / /
  --bind <run>/out <run>/out --dev /dev --proc /proc --tmpfs /tmp --unshare-pid
  --unshare-ipc --unshare-uts --unshare-net --die-with-parent`.
- only `<run>/out` is persistently writable; `/tmp` is tmpfs, `/dev` is devtmpfs; the
  run directory itself is not writable inside the sandbox.
- `network=PrivateNetwork=yes` in the unit and `--unshare-net` in bwrap; routes not
  independently verified.
- The fixtures are pure gate tests and are expected to write nothing;
  `out_dir_usage=not_inspected_by_this_runner`.

## 6. Named hashes (6 files, not closure)

Scope: `6_fixed_named_files_only_not_closure_not_tree_walk`,
`node_modules_never_traversed=yes`. Before and after were identical.

| Input | SHA-256 | vs previous 75 run |
| --- | --- | --- |
| `loader-fixture-unit/run.sh` | `dd793eed41378bf4ea471c8c5141e08fcc4a98b493b7144f78724959d34615dd` | same |
| `loader-fixture-unit/payload.sh` | `06f7d8681b93f93073f38939412c99e4bb392ea43dc4ea65b615c44d5d7a32c4` | same |
| `toolkit-loader/fixture.test.mjs` | `d26d332d4479ad8bf5dc58ad163bb05b5b28ebc4f45b25aeda9954e68aa32a55` | same |
| `toolkit-loader/fixture.mjs` | `dabd744ceea5975c21b7c8ca92f0deeab36d23c815322f7fce6b75ea9c6a124a` | same |
| `harbor-loader/fixture.test.mjs` | `a41c3f8d993fa12e0e4f75fb768fe37c474436c0aadce3f0720c48638f64ac56` | **changed** (was `79e9c2b0…`) |
| `harbor-loader/fixture.mjs` | `08059fd3dbcf8367c27d45abbcdc13ee9f75049188c26775e466e6ba1fb5349f` | **changed** (was `e9df8c1e…`) |

Both Harbor files changed since the 75-case run, so this is a re-run of changed bytes,
not a byte-identical repeat. Only the two Harbor fixture files and the GO/history files
were touched by this step.

## 7. Terminal state and cleanup

```
before_stop load=not-found active=inactive sub=dead main_pid=0 terminal_state=not_found_loadstate_mainpid0
cleanup_action=skipped_already_terminal … reset_failed=not_attempted_by_design
after load=not-found active=inactive sub=dead main_pid=0 after_state=not_found_loadstate_mainpid0 after_terminal_confirmed=yes
unit_unload_guaranteed=no
```

`unit_unload_guaranteed=no`: a terminal unit proves the unit ended, not that any plugin
cleanup ran. No `unit-scan` beyond what the runner recorded was performed.

## 8. What was actually exercised — and what was not

The Harbor-side cases here run against:

- a **throwaway temp filesystem** for the path gates (`hubPathGate`,
  `configuredNameGate`, exemption-style site checks): real `mkdtemp` trees, real
  files, real symlinks, real digests —
- and **repo-file-backed mocked control flow** for `runScenario`: the scenario
  orchestrator is driven with injected collaborators so the assertions can observe
  "no boot happened", "no request was issued" and "the row was configured with
  another file", without any host, socket or real HTTP.

Therefore:

- **No real boot, no plugin mount, no host service, no socket, and no HTTP GET
  occurred.** `httpGet` cases drive a mocked request surface; `runScenario` cases
  assert *that nothing was attempted*.
- Passing means the fixtures' own gates accept/refuse the shapes they claim to. It is
  not evidence about the real Harbor plugin, a real Loader, a real dsh host, or a real
  workstation hub endpoint.
- The `hubPathGate` digest and canonical-path checks use real files on the real disk,
  so their "accepts the fixed target / refuses another file" behaviour is filesystem
  evidence for those paths only — not evidence that the plugin resolves the same path
  at run time.

## 9. Deviation disclosure, including prior work by another agent

- **`dfdf`'s earlier shell/Python use is disclosed in the two Harbor documents and is
  not counted as compliance for this run.** Those acts were outside the tool
  permissions in force for that work; this record does not launder them, and the
  present run's compliance rests only on what is listed below.
- This run itself executed exactly one command: the authorised `bash .../run.sh unit`.
  No pre-run, no second attempt, no retry, no limit raise, no install, no build, no
  `chmod`, no source patch, no Loader boot, no extra scan.
- All evidence above was read with file reads after the run; no shell was used to
  collect or recompute evidence.
- `dfdf` had no execution rights here and ran nothing; the Toolkit real-Loader
  experiment was **not** re-run, and its earlier `0` result stands unchanged.
- The `/tmp` and `/dev` notes in §5 record what the sandbox does, not a claim that
  anything was written there.

Raw links:
[unit.log](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/unit.log),
[status](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/loader-fixture-status.txt),
[verdict](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/verdict.txt),
[manifest](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/loader-fixture-manifest.txt),
[hashes-before](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/hashes-before.txt),
[hashes-after](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/hashes-after.txt),
[cleanup](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/unit-cleanup.txt),
[unit props](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/unit-props.txt),
[node rc](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T183234Z-lfx-unit-446047-24852/node-exit-code.txt).

Earlier results stay as recorded: `2026-11-05-loader-fixture-unit.md` (72),
`2026-11-05-loader-fixture-unit-recheck.md` (53), `2026-11-05-loader-fixture-canonical-recheck.md`
(57), `2026-11-06-toolkit-exemption-unit.md` (75).
