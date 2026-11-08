# Loader-fixture gate tests — restricted unit RETEST (STATUS: RAN ONCE, PASSED)

**Date:** 2026-11-05
**Slice:** `experiments/third-party-pilots/loader-fixture-unit/`
**Status:** executed exactly once under a single-use Lead GO. `lfx_overall_rc=0`, node
`tests 53 / pass 53 / fail 0 / skipped 0`. The retest differs from the failed first
run only by one comment line in `toolkit-loader/fixture.mjs` (§4).

This record is the retest. The first (failed) run is recorded in
`projects/dsh-plugin-kit/docs/testing/2026-11-05-loader-fixture-unit.md` §8 and is
not overwritten; that document keeps its failure evidence and links here (§6).

## 1. Authorisation handling

- Read the existing `experiments/third-party-pilots/loader-fixture-unit/GO-unit.txt`
  first (2 lines: `GO unit` plus the consumed note of the first run).
- That full consumed content was saved with the file tool to a new, uniquely named
  file that did not exist before:
  `experiments/third-party-pilots/loader-fixture-unit/GO-unit.history.20261105T135920Z.txt`
  (2 lines, read back and compared line for line — identical).
- Only after that, the working gate was written as the strict single line `GO unit`
  (read back: 1 line).
- After the run, the consumption note was appended and the original `GO unit` line
  preserved.

## 2. Command and identifiers

Exactly one command:

```
bash experiments/third-party-pilots/loader-fixture-unit/run.sh unit
```

| Item | Value |
| --- | --- |
| run dir | `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T140409Z-lfx-unit-439433-30899/` |
| unit | `lfx-third-party-unit-20261105T140409Z-439433` |
| launcher exit / `lfx_overall_rc` | `0` |

Nothing else was executed: no `bash -n`, no standalone `node`, no install, no build,
no scan, no Loader boot, no socket, no retry, no raised limit.

## 3. Exact counts, read from `unit.log`

node's own summary: `tests 53`, `suites 0`, `pass 53`, `fail 0`, `cancelled 0`,
`skipped 0`, `todo 0`, `duration_ms 459.622299`. Per-file split, from the same file:
Harbor's 33 checks (`constants`/`targetRefusal`/`parseOutDir`/catalog+assertion ids/
`httpGet`/`responseIsComplete`) and the Toolkit file's 20 checks
(`contract` ×8, `mount gate` ×3, `disable gate` ×7, `overlay`, `parseArgs`), all ✔.
Service side: `Service runtime: 879ms`, `CPU time consumed: 370ms`,
`Memory peak: 66.6M (swap: 0B)`, `Main processes terminated with: code=exited,
status=0/SUCCESS`.

The two rows that pin the row-state gate stay visible in this run: `disable gate
accepts a disposed row (the source-visible shape)` and `disable gate accepts a
disabled row with no fiber currently observable` — the second is the wording agreed
after the "currently observable, not never attached" correction.

## 4. Only input difference from the first run

`toolkit-loader/fixture.mjs`, one comment line in the `TOOL_NAMES` doc block:

```
- * Read from `packages/dsh-tool-*/lib/index.js` in the extracted tree (each
+ * Read from `packages/dsh-tool-<name>/lib/index.js` in the extracted tree (each
```

The old text contained `*/` inside the block comment, which closed it early and made
the prose at line 150 parse as code (`SyntaxError: Unexpected identifier 'name'`).
Everything else — both test files, both fixtures other than that line, `run.sh`,
`payload.sh`, the envelope — is unchanged, as the named hashes in §5 show.

## 5. Named-hash evidence (within this run, and across the two runs)

This run, `hashes-before.txt` = `hashes-after.txt` byte for byte
(`hash_status=identical`, `hash_rc=0`):

```
dd793eed41378bf4ea471c8c5141e08fcc4a98b493b7144f78724959d34615dd  loader-fixture-unit/run.sh
06f7d8681b93f93073f38939412c99e4bb392ea43dc4ea65b615c44d5d7a32c4  loader-fixture-unit/payload.sh
1ba63ea3ea076b7285a859e22a75f2af9ad4a3eddd90f9b828dd350953368c3c  toolkit-loader/fixture.test.mjs
1c23145fc7e153c3473614a69a8b69f71059bad197e057dfdff242ac34c23efa  toolkit-loader/fixture.mjs
79e9c2b07ff0e27066a94a5f145284eb2fdeb25e4815b2eafa424df4a9f753fd  harbor-loader/fixture.test.mjs
e9df8c1e1bee20a6a5d6bc18e9735dc1ee5cd5d022400a159fe896f34db9b578  harbor-loader/fixture.mjs
```

Across the two runs, exactly one of the six differs — the fixed file:

| File | First run | Retest |
| --- | --- | --- |
| `loader-fixture-unit/run.sh` | `dd793eed…` | `dd793eed…` (same) |
| `loader-fixture-unit/payload.sh` | `06f7d868…` | `06f7d868…` (same) |
| `toolkit-loader/fixture.test.mjs` | `1ba63ea3…` | `1ba63ea3…` (same) |
| `toolkit-loader/fixture.mjs` | `949ce123…` | `1c23145f…` (**changed: the one comment line**) |
| `harbor-loader/fixture.test.mjs` | `79e9c2b0…` | `79e9c2b0…` (same) |
| `harbor-loader/fixture.mjs` | `e9df8c1e…` | `e9df8c1e…` (same) |

This is a **named set, not a closure**: the scenario trees these fixtures point at
(the extracted Toolkit tree, `toolkit-rollback-modified/pkg`, Harbor's data),
`node_modules`, the Node runtime and the harness packages are outside it and can
change without any hash noticing.

## 6. Exit codes, envelope, terminal state

| Source | Value |
| --- | --- |
| launcher overall / verdict `overall_rc` | `0` / `0` |
| verdict `unit_rc` | `0` |
| `systemd-run.rc` | `0` |
| `sandbox_invocation_rc` | `0` |
| `node_status` | `node_0_interpreted_as_all_tests_passed_source_unverified` |
| `workload_verdict` | `pass` |

`source_attribution=not_distinguished_between_bwrap_setup_and_node_workload` and
`node_start_not_independently_proven=yes` are recorded in every file: the `0` is an
interpretation of one bwrap exit status.

Effective caps, read back **inside** the unit (`cgroup_proof=yes`,
`unit_proof=yes`): `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`; `Type=exec`, `RuntimeMaxUSec` raw `2min` →
`120000000` µs, `MemoryMax=805306368`, `TasksMax=32`. MemAvailable gate
`1542056 ≥ 1228800` KiB, one launcher sample (`lfx_gate=pass`,
`lfx_gate_samples=1`). Sandbox: `--ro-bind / /` with only this run's `out/`
persistently writable, `--dev /dev`, `--proc /proc`, `--tmpfs /tmp`,
`--unshare-pid/-ipc/-uts/-net`, `--die-with-parent`,
`env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`, `--max-old-space-size=384`,
`--test --test-concurrency=1`, two literal files.

Terminal state: `not_found_loadstate_mainpid0` (`LoadState=not-found`,
`ActiveState=inactive`, `SubState=dead`, `MainPID=0`, `show_rc=0`),
`cleanup_action=skipped_already_terminal`, `cleanup_stop_rc=not_attempted`,
`cleanup_reset_failed_rc=not_attempted`,
`state_after_cleanup=not_found_loadstate_mainpid0`, `after_show_rc=0`,
`after_terminal_confirmed=yes`, `unit_unload_guaranteed=no`. `unit-scan.txt` is
empty: no `lfx-*/cpy-*/tkb-*/rbk-*/harbor-*/exc-*/acq-*/p0-*/acc-*/admission-*` unit
was active before the run.

## 7. Raw evidence links

Relative to `experiments/third-party-pilots/loader-fixture-unit/runs/20261105T140409Z-lfx-unit-439433-30899/`:
`verdict.txt`, `loader-fixture-manifest.txt`, `loader-fixture-status.txt`,
`node-exit-code.txt`, `systemd-run.rc`, `unit.log`, `unit-envelope.txt`,
`unit-props.txt`, `unit-props-after.txt`, `unit-cleanup.txt`, `unit-scan.txt`,
`gate.txt`, `argv.txt`, `preconditions.txt`, `hashes-before.txt`,
`hashes-after.txt`.

First (failed) run, for comparison, relative to
`experiments/third-party-pilots/loader-fixture-unit/runs/20261105T135008Z-lfx-unit-439057-3034/`:
`unit.log` (the `SyntaxError` at `toolkit-loader/fixture.mjs:150`), `verdict.txt`,
`loader-fixture-manifest.txt`, `node-exit-code.txt`. Its full record is
`projects/dsh-plugin-kit/docs/testing/2026-11-05-loader-fixture-unit.md` §8.

## 8. What this does and does not establish

**Does**: that the two fixtures' gate tests, as written and hashed in §5, run to
completion under the envelope above and agree with the judgments they encode — the
resolver-contract gate, the mount gate, the row-state/disable gate for both accepted
stop shapes and all four refusal shapes, the overlay row, argument parsing, and
Harbor's target/parsing/`httpGet`/completeness gates.

**Does not**: verify a Loader, a plugin mount, a plugin disable/enable, a disposal
path, tool execution, host services or permissions. A green unit is **not** Loader
evidence and must not be cited as such (`not_loader_evidence=yes`). It says nothing
about `src`↔`lib` compile consistency in the modified Toolkit tree, nothing about API
compatibility beyond what the fixtures encode, and nothing about cleanup
(`unit_unload_guaranteed=no`). No network mock stands in for HTTP here either: the
Harbor `httpGet` checks run against loopback fixtures and are not HTTP evidence.

## 9. Deviations

- The retest was authorised once and run once; no extra pre-run, no install, no
  build, no scan, no retry, no raised limit.
- Evidence after the run was read only with the file tools (`read`/`glob`).
- Harbor's own files were not touched by the comment fix, and their hashes are
  unchanged across the two runs.
- Earlier disclosures in other slices (one read-only `bash ls`; one `python3`
  heredoc; Harbor's author's one read-only `bash grep`/`sed`) are unchanged and not
  repeated here.
