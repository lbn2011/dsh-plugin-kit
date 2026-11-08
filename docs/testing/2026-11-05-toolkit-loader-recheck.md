# Toolkit on a real Loader — second authorised run (STATUS: RAN ONCE, FAILED AT MOUNT)

**Date:** 2026-11-05
**Slice:** `experiments/third-party-pilots/toolkit-loader/`
**Run:** `tkl_overall_rc=72`, fixture exit `71` (assertion failure), scenario `original` only.
**This file is a new record.** The first run's record
(`2026-11-05-toolkit-loader.md`, `70` / `RESOLUTION_TOOLS_ENTRY_ELSEWHERE`) is
preserved unchanged; only a link was appended to it.

## 1. Authorisation and gate handling

One run of the existing entry point was authorised, with the fixture and runner
**frozen** (no resolution change, no source edit, no retry):

```
bash experiments/third-party-pilots/toolkit-loader/run.sh loader
```

`GO-loader.txt` was already spent (it held `GO loader` plus the first round's
consumption line). Sequence, without moving or deleting anything:

1. read `GO-loader.txt` with the file tools (2 lines);
2. wrote that exact content to a brand-new `GO-loader.history.20261105T153520Z.txt`
   and read it back — 2 lines, identical;
3. only then replaced `GO-loader.txt` in place with the strict single line
   `GO loader` and read it back (1 line);
4. after the run, appended the consumption line (§10).

## 2. Run identity and exact command

| Item | Value |
| --- | --- |
| run dir | `experiments/third-party-pilots/toolkit-loader/runs/20261105T153714Z-tkl-loader-441797-26138/` |
| systemd unit | `tkl-third-party-loader-20261105T153714Z-441797` |
| mode | `loader` (exactly one mode; no chaining, no retry) |
| command | `node --max-old-space-size=384 <fixture.mjs> --out <run>/out` (plain node, **not** `--test`) |
| fixture CLI | `--out` only — the sole argument `parseArgs` accepts |

## 3. What actually happened, in the fixture's own words

`out/toolkit-loader-report.txt` (11 lines, quoted in full below in §4) records this
order for `scenario=original`:

1. `status=starting`, tree = the extracted Toolkit `c3319d9d…`;
2. throwaway home + `headless` profile created under `/tmp`;
3. profile link `…/node_modules/@deepseek-ai/dsh-toolkit` → the scenario tree,
   `created=yes`;
4. **resolution contract passed**: `resolution_entries=634`,
   `tools_entry=…/packages/context/agent-instructions/node_modules/@deepseek-ai/dsh-tools`,
   `tools_scope=installation`, `linked_root=@deepseek-ai/dsh-toolkit`,
   `linked_real=<scenario tree>`. So the canonical-path correction from §11 of the
   previous record did its job: the symlink-spelled entry is now accepted.
5. root `cordis.yml` and the overlay patch were written;
6. the loader was given the row `include:toolkit-loader-fixture`, and the host
   **booted** — this is visible outside the report, in `unit.log` (§5), which carries
   app-boot's own messages about that exact row;
7. `step=mount` observation after `waited_ms=20010` / `samples=1868`:
   `resolved=yes row_state=absent row_disabled_flag=yes fiber_present=no
   resolve_error=(none) present=0 absent=time,encoding,json,calculator,csv,regex,markdown,diff,stat,schema
   ok=no problems=row_state_absent,row_marked_disabled,tools_0_of_10`;
8. `teardown=fulfilled`;
9. `result=failed`; `summary stopped_after=original result=failed`.

**`scenario=modified` never ran.** The fixture stops after the first failing
scenario, so the rollback-modified tree was never loaded, and nothing in this run
says anything about it.

## 4. Assertions: what was and was not counted

There is no "53/57-style" total here: the fixture is a program, not a test run, and
it emits named steps rather than a TAP count. What the report actually contains for
the run:

| Step | Outcome |
| --- | --- |
| resolution contract | **passed** (634 entries, installation scope, linked root recorded) |
| link creation | passed (`created=yes`) |
| root config + overlay write | passed (both paths recorded) |
| `step=mount` | **failed**, with three problems: `row_state_absent`, `row_marked_disabled`, `tools_0_of_10` |
| `step=disable` / re-enable | **never reached** (mount failed first) |
| teardown | `fulfilled` |
| `scenario=modified` | **never started** |

So: **one** assertion step failed, zero tools were registered, and the four later
gates (mount-visible, disable, re-enable, teardown-of-registrations) were not
exercised.

## 5. The actual reason the row never mounted (`unit.log`)

`unit.log` line 2, verbatim:

```
dsh: disabling profile plugin row "toolkit-loader-fixture": Plugin
@deepseek-ai/dsh-toolkit@0.0.1 is incompatible with dsh 0.2.2-alpha.2:
requirements {"@deepseek-ai/dsh-invariants":">=0.0.1-rc.1 <0.2.0",
"@deepseek-ai/dsh-tools":">=0.0.1-rc.1 <0.2.0"}. Running it may cause crashes or
data loss. Update the plugin or install a plugin version compatible with this dsh
runtime. To accept this risk explicitly, grant the exact-version exemption for
@deepseek-ai/dsh-toolkit@0.0.1 on dsh 0.2.2-alpha.2 with `dsh plugin allow-version`
or the plugin manager, then retry the installation or restart dsh.
Exact-version exemption: not active.
```

`unit.log` line 3: `dsh: warning: 20 entries did not activate`, followed by the
`pending (waiting for service: …)` list (unrelated to this row; the headless profile
does not provide those services).

Read narrowly, this says: the runtime's **plugin compatibility gate** refused to
activate the row because the plugin's declared peer range
`>=0.0.1-rc.1 <0.2.0` does not admit `dsh 0.2.2-alpha.2`, the row was marked
disabled, and an exact-version exemption was **not** active. The row therefore had
no fiber, so the ten `ctx.tools.register` calls never happened and no tool appeared.

This is the first Loader-level observation in this pilot that the declared peer range
is not merely metadata: the host enforces it and stops the plugin before `apply` runs.
It is **not** evidence that the Toolkit's code would fail if it ran — nothing of the
Toolkit executed.

## 6. Exit codes: raw and interpreted

| Evidence | Value |
| --- | --- |
| `systemd-run.rc` | `72` (unit died by exit code) |
| `sandbox_invocation_rc` (`node-exit-code.txt`) | `71` |
| fixture meaning of `71` | assertion failure (fixture's own code) |
| `unit_rc` / `overall_rc` | `72` / `72` |
| `toolkit-loader-status.txt` | `result=assertion_failed`, `work_rc=72`, `workload_verdict=assertion_failed` |
| `node_status` | `fixture_71_interpreted_as_assertion_failure_source_unverified` |
| `hash_rc` / `hash_status` | `0` / `identical` |
| `unit.log` tail | `Finished with result: exit-code`, `status=72/OSFILE` |

The `71` is an interpretation of one bwrap exit status
(`cause_not_distinguished_between_bwrap_setup_and_node_workload=yes`,
`node_start_not_independently_proven=yes`). The failure itself is independently
visible in the fixture's own report and in app-boot's own message, which is why both
are quoted rather than inferred.

## 7. Caps, gate and sandbox (read back inside the unit)

From `toolkit-loader-manifest.txt`:

```
cgroup_memory_max=805306368      cgroup_memory_swap_max=0
cgroup_pids_max=32               cgroup_cpu_max=50000 100000
cgroup_proof=yes
unit_runtime_max_raw=2min        unit_runtime_max_normalized_usec=120000000
unit_memory_max=805306368        unit_tasks_max=32
unit_proof=yes
memavailable_gate_kib=1369444 required_kib=1228800 sampled_by=launcher_once
preconditions=ok
```

Service metrics from `unit.log`: `Service runtime: 25.122s`, `CPU time consumed:
3.556s`, `Memory peak: 169M (swap: 0B)`. Sandbox: `env -i PATH=/usr/bin:/bin
HOME=/tmp TMPDIR=/tmp`, `--ro-bind / /`, exactly one persistent writable bind (the
run's `out/`), `--tmpfs /tmp`, `--dev /dev`, `--proc /proc`,
`--unshare-pid/-ipc/-uts/-net`, `--die-with-parent`. Routes are not independently
verified.

Note the runtime: 25 s, versus the first run's 1.4 s — the fixture waited its full
20 s for a row that was never going to activate.

## 8. Inputs, pin, and the hash scope

Pin gate (`checkout-pin.txt` and `verdict.txt`):
`expected_pin=actual_head=ce7073d51254c26cd63b22a60835b8f948deb447`,
`rev_parse_rc=0`. Proven: **the commit this working tree reports**. Not proven:
working-tree or ignored build bytes.

`hashes-before.txt` and `hashes-after.txt` are byte-identical
(`hash_status=identical`, 9 named files):

| File | sha256 |
| --- | --- |
| `toolkit-loader/run.sh` | `2b638250b7612ec3d6ee55fa4c54eb4d098ee841ed92f92f8d846746253277ca` |
| `toolkit-loader/payload.sh` | `addbe8fd32be1c8b8c7d3c77383d0dade2a5f3011fde45fc6be216c599d39f88` |
| `toolkit-loader/fixture.mjs` | `856a8bd58a8e322ceccd4c250dcb3a216f517385ee0f2f5620882ca5c7f4bbd9` |
| original `…/dsh-toolkit-c3319d9d…/lib/index.js` | `8f1ea603ac00dfb1cbba715c5b7a4444d9b87c1aa7317a735f7de6e93f684ca5` |
| modified `pkg/lib/index.js` | `952a166d5b3bacc7873427b205d42b46ccd6a7ada846264573394da7467f1a67` |
| modified `pkg/src/index.ts` | `33627fa86d3cd1714b750fcfdd1f9c1a21e161ce2087c97e01bf2898667721c5` |
| checkout `packages/core/tools/package.json` | `da8ee05328d8d0865ab690f4b8cb066e8782f44ed9be679a51859d5e49de7005` |
| checkout `packages/core/tools/lib/index.js` | `1889cbf718d64518dd83245d4dba1e1f080b2c5326259c3ed5b1be7a7666a2bd` |
| checkout `apps/cli/package.json` | `24e6053ed5368db6c17e6524cd2b959e594388205d9ba2d0360cdb0ccd734c88` |

Scope, as the runner declares it: **named set only — not a closure, not a tree walk;
`node_modules` never traversed.** The plugin's ten sub-package `lib/index.js` files
are *not* in this set (only the root entry of each tree is); transitively required
code is outside it.

Compared with the first run: `fixture.mjs` changed
(`1c23145f…` → `856a8bd5…`, the canonical correction) and `run.sh` / `payload.sh` /
all Toolkit and checkout hashes are unchanged.

## 9. Terminal state, cleanup, provenance

`unit-cleanup.txt`:

```
before_stop load=loaded active=failed sub=failed main_pid=0 terminal_state=failed_mainpid0
cleanup_action=skipped_already_terminal load_state=loaded active_state=failed reset_failed=not_attempted_by_design
after load=loaded active=failed sub=failed main_pid=0 after_state=failed_mainpid0 after_terminal_confirmed=yes
unit_unload_guaranteed=no
```

`stop`/`reset-failed` were not called: the unit had already failed and been
collected. `unit-scan.txt` is empty. Evidence was collected with the file tools only
(`unit.log`, `verdict.txt`, `toolkit-loader-manifest.txt`,
`toolkit-loader-status.txt`, `checkout-pin.txt`, `gate.txt`,
`hashes-before/after.txt`, `unit-cleanup.txt`, `systemd-run.rc`,
`node-exit-code.txt`, and the fixture's `out/toolkit-loader-report.txt`). No extra
probes, no retry, no limit increase, no install, no build, no source edit.

## 10. Gate re-closed

```
GO loader
consumed=yes run_id=20261105T153714Z-tkl-loader-441797-26138 overall_rc=72 reason=assertion_failed single_use_authorization_spent=yes fixture_exit=71 mount_failed_after_row_disabled_by_compatibility_gate previous_run=20261105T144447Z-tkl-loader-440458-22870 previous_consumed_backup=GO-loader.history.20261105T153520Z.txt
```

## 11. What this run supports, and what it does not

**Supports (dated, this host, these inputs):**

- The corrected resolution contract accepts the pinned checkout's real
  `@deepseek-ai/dsh-tools` entry (symlink-spelled, installation scope): this is now
  observed against the **real** `createRuntimeResolution` output, not a mock.
- A real app-boot Loader booted, inserted the fixture row and evaluated it.
- The host's plugin compatibility gate **disables** this plugin row because its
  declared peer range excludes `dsh 0.2.2-alpha.2`, and reports that no exact-version
  exemption is active.
- Consequently zero tools registered (`tools_0_of_10`) and `fiber_present=no`.
- Teardown of the host still fulfilled.

**Does not support:**

- Nothing about whether the Toolkit works: `apply` never ran (`present=0` of 10).
- No mount, disable, re-enable or registration-removal evidence; those steps were
  never reached.
- Nothing about the modified tree: `scenario=modified` never started.
- Nothing about the rollback aggregation behaviour (already covered only by the
  bridge-based differential run, which is not Loader evidence).
- Nothing generalisable to other hosts, other dsh versions, or to Harbor.
- The `72`/`71` are interpretations of one bwrap status; the failure is established
  by the fixture report and the app-boot message, not by the code.

## 12. Deviations

- The single command executed was the authorised `run.sh loader`; the fixture and
  runner were not modified before or after it.
- `GO-loader.txt` was restored to a working single line via the
  backup-then-in-place-rewrite sequence in §1 (the earlier history line is preserved
  in a separate file; nothing was moved or deleted).
- No genuine deviation in evidence collection: no `bash -n`, no extra shell probes,
  no re-run, no retry, no limit increase.
- `git rev-parse` inside the launcher is part of the frozen runner, not an extra
  probe added for this run.
