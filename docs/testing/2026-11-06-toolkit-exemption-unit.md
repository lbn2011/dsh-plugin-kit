# Kit gate-layer unit re-run after the exemption work (2026-11-06)

STATUS: **RAN ONCE — PASSED (75 / 75)**. This is the **fourth** run of this slice
(the earlier three were `72`, then `0` at 53, then `0` at 57; this is `0` at 75).
It is a gate-layer unit run of two fixtures' pure judgments. It is **not** Loader
evidence, **not** plugin evidence, and **not** proof that the official exact-version
exemption gate admits anything.

## 1. Authorization and GO handling

- Authorization: one run of the existing
  `experiments/third-party-pilots/loader-fixture-unit/run.sh unit`. No pre-run,
  no install, no build, no Loader boot, no extra scan, no retry, no limit raise.
- `GO-unit.txt` had already been consumed (2 lines: `GO unit` plus the previous
  consumption line). It was read first, then copied verbatim into a brand-new
  file `GO-unit.history.20261105T174200Z.txt` (created, never overwritten), read
  back and compared line for line — 2 lines, identical — and only then was
  `GO-unit.txt` rewritten in place as the strict single line `GO unit`.
- After the run the same file was reopened and appended with the consumption
  line below, so the gate is closed again.
- `GO-unit.txt` now reads:

  ```
  GO unit
  consumed=yes run_id=20261105T174450Z-lfx-unit-444769-21668 overall_rc=0 reason=pass single_use_authorization_spent=yes runner_summary=node_tests_75_pass_75_fail_0 skipped_0 previous_run=20261105T152657Z-lfx-unit-441467-24262 previous_consumed_backup=GO-unit.history.20261105T174200Z.txt
  ```

## 2. Identity

| Item | Value |
| --- | --- |
| run id | `20261105T174450Z-lfx-unit-444769-21668` |
| unit | `lfx-third-party-unit-20261105T174450Z-444769` |
| run dir | `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/` |
| mode | `unit` (single mode; no chaining) |
| node | `/www/server/nodejs/v24.21.0/bin/node`, `--max-old-space-size=384 --test --test-concurrency=1`, two literal files |
| launcher rc | `lfx_overall_rc=0` |

## 3. Actual counts (raw `unit.log`)

- `ℹ tests 75`, `ℹ pass 75`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`,
  `ℹ todo 0`, `ℹ duration_ms 592.414865`.
- `Finished with result: success`; `status=0/SUCCESS`.
- Service side: `Service runtime: 978ms`, `CPU time consumed: 405ms`,
  `Memory peak: 66.2M (swap: 0B)`.
- Breakdown by block: Harbor fixture 33 cases, Toolkit fixture 42 cases
  (constants/targetRefusal/parseOutDir/catalog/assertionIds/httpGet/
  responseIsComplete = 33 for Harbor; contract 12, mount gate 3, disable gate 7,
  overlay 1, parseArgs 1, exemption site 8, readback gate 4, grant 6 = 42 for
  Toolkit). The last 18 of those are the exemption additions.

## 4. Exit codes: raw and interpreted

| Code | Value | Note |
| --- | --- | --- |
| `unit_rc` | `0` | runner's own verdict |
| `overall_rc` | `0` | same |
| `systemd-run.rc` | `0` | unit itself exited 0 |
| `node-exit-code.txt` (raw sandbox invocation rc) | `0` | the single bwrap exit status |
| `hash_status` / `hash_rc` | `identical` / `0` | six fixed inputs unchanged across the run |
| `node_status` | `node_0_interpreted_as_all_tests_passed_source_unverified` | an interpretation, not an independent observation |
| `workload_verdict` | `pass` | |

`source_attribution=not_distinguished_between_bwrap_setup_and_node_workload`: the
codes above are interpretations of one bwrap exit status. No extra probe was
added to separate sandbox setup from the workload.

## 5. Envelope, sandbox and gate (from `loader-fixture-manifest.txt`)

- cgroup: `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
  `cpu.max=50000 100000`, `cgroup_proof=yes`.
- unit: `Type=exec`, `unit_runtime_max_raw=2min` →
  `unit_runtime_max_normalized_usec=120000000`, `unit_memory_max=805306368`,
  `unit_tasks_max=32`, `unit_proof=yes`.
- capacity gate: `memavailable_gate_kib=1427416` ≥ `required_kib=1228800`,
  sampled by the launcher once (`sampled_by=launcher_once`), not re-proved inside
  the unit.
- sandbox: `env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`; `bwrap
  --ro-bind / / --bind <run>/out <run>/out --dev /dev --proc /proc --tmpfs /tmp
  --unshare-pid --unshare-ipc --unshare-uts --unshare-net --die-with-parent`.
- only `<run>/out` is persistently writable; `/tmp` is a tmpfs and `/dev` is a
  devtmpfs (writable, not persistent); the run directory itself is not writable
  inside the sandbox.
- `network=PrivateNetwork=yes` in the unit **and** `--unshare-net` in bwrap;
  routes are not independently verified.
- `out_dir_usage=not_inspected_by_this_runner` — these are pure gate tests
  expected to write nothing, and the runner does not enumerate `out/`.

## 6. Input hashes, and the delta against the previous 57-case run

`hash_status=identical`, `hash_rc=0`, scope
`6_fixed_named_files_only_not_closure_not_tree_walk`, `node_modules_never_traversed=yes`.

| Input | This run | Previous run (57 cases) | Changed? |
| --- | --- | --- | --- |
| `loader-fixture-unit/run.sh` | `dd793eed41378bf4ea471c8c5141e08fcc4a98b493b7144f78724959d34615dd` | same | no |
| `loader-fixture-unit/payload.sh` | `06f7d8681b93f93073f38939412c99e4bb392ea43dc4ea65b615c44d5d7a32c4` | same | no |
| `toolkit-loader/fixture.test.mjs` | `d26d332d4479ad8bf5dc58ad163bb05b5b28ebc4f45b25aeda9954e68aa32a55` | `f6b5805d…` | **yes** |
| `toolkit-loader/fixture.mjs` | `dabd744ceea5975c21b7c8ca92f0deeab36d23c815322f7fce6b75ea9c6a124a` | `856a8bd5…` | **yes** |
| `harbor-loader/fixture.test.mjs` | `79e9c2b07ff0e27066a94a5f145284eb2fdeb25e4815b2eafa424df4a9f753fd` | same | no |
| `harbor-loader/fixture.mjs` | `e9df8c1e1bee20a6a5d6bc18e9735dc1ee5cd5d022400a159fe896f34db9b578` | same | no |

The two changed Toolkit inputs are why this is **not** a like-for-like re-run of
the same bytes: `fixture.mjs` gained the exemption gates and `fixture.test.mjs`
gained the exemption site/readback/grant cases plus the pre-run wording fixes
described in §9. Case count therefore moved 57 → 75 (+18), and no case from the
earlier run was removed or renamed away silently.

## 7. Terminal state and cleanup

`unit-cleanup.txt`:

```
before_stop load=not-found active=inactive sub=dead main_pid=0 terminal_state=not_found_loadstate_mainpid0
cleanup_action=skipped_already_terminal terminal_state=not_found_loadstate_mainpid0 load_state=not-found active_state=inactive reset_failed=not_attempted_by_design
after load=not-found active=inactive sub=dead main_pid=0 after_state=not_found_loadstate_mainpid0 after_terminal_confirmed=yes
unit_unload_guaranteed=no
```

`unit-scan.txt` is empty (no `lfx-*`/`tkl-*`/`cpy-*`/`tkb-*`/`rbk-*`/`hbl-*`/
`harbor-*`/`exc-*`/`acq-*`/`p0-*`/`acc-*`/`admission-*` unit left behind).
`unit_unload_guaranteed=no`: a terminal state and an empty scan are not a proof
about anything the unit loaded, and in this run the unit never loaded a plugin.

## 8. What this run supports, and what it does not

Supports (narrowly): the pure judgment functions in both fixtures behave as
their tests describe on this machine, in this envelope, with the six inputs
above — including the exemption **site**, **readback** and **grant-flow** gates
against a mock app-boot surface and a throwaway temp filesystem.

Does **not** support:

- that the official exact-version exemption gate admits
  `@deepseek-ai/dsh-toolkit@0.0.1` on runtime `0.2.2-alpha.2` — the mock surface
  is not the official gate, and no real grant was ever written;
- anything about a real Loader, a real plugin mount, a real host service or a
  socket (`not_loader_evidence=yes`, `no_loader_boot=yes`,
  `no_plugin_mount=yes`);
- anything about `entry.boot`, `disposeHost`, or the fixture's own two-scenario
  run — none of that was executed here;
- closure over transitive dependencies: only six named files were hashed.

## 9. Deviations and pre-run edits

- **Pre-run edits (authorized, code only, before the GO was armed):** the test
  title at `toolkit-loader/fixture.test.mjs:569` changed from "the official
  setter" to "the mock setter"; the destructured variables at `:577` were renamed
  from `rewritable`/`allowCreate` to `enabled`/`acceptRisk` to match the official
  parameter names, with the asserted values unchanged; the file header comment and
  the section comment at `:523` were corrected the same way. These edits are why
  `fixture.test.mjs` has a new hash.
- `fixture.mjs` had already changed before this run because of the four
  tightening requirements on the exemption implementation; that is the other new
  hash, and it is the reason the case count grew.
- No command was run before or after the single authorized run except that one
  invocation; all evidence above was read with file reads, not with shell
  utilities.
- No `bash -n` syntax check was performed (it would have been a second command).
- No failure injection was attempted for the evidence-write paths, and no disk-full
  or network condition was simulated.
- The raw run directory links:
  [status](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/loader-fixture-status.txt),
  [verdict](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/verdict.txt),
  [manifest](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/loader-fixture-manifest.txt),
  [unit.log](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/unit.log),
  [hashes-before](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/hashes-before.txt),
  [hashes-after](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/hashes-after.txt),
  [cleanup](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/unit-cleanup.txt),
  [unit scan](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/unit-scan.txt),
  [unit props](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/unit-props.txt),
  [node rc](/root/dsh-ecosystem-spec/experiments/third-party-pilots/loader-fixture-unit/runs/20261105T174450Z-lfx-unit-444769-21668/node-exit-code.txt).

Previous results are unchanged: the 42/2/1 failure run, the 45/0/1 run, the
46/0/0 run, the 53-case run, and the 57-case run all remain as recorded in
`2026-11-05-loader-fixture-unit.md`, `2026-11-05-loader-fixture-unit-recheck.md`
and `2026-11-05-loader-fixture-canonical-recheck.md`.
