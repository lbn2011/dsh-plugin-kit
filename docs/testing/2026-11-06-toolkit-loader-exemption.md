# Toolkit real-Loader run under the one exact-version exemption (2026-11-06)

STATUS: **RAN ONCE — BOTH SCENARIOS PASSED** (original, then modified).
This is real-Loader evidence for one dated observation on this machine. It is
**not** a native-compatibility certification of the plugin, and the exemption is an
experimental local grant, not a host-approved support statement.

## 1. Authorization

- One run of the existing `experiments/third-party-pilots/toolkit-loader/run.sh loader`.
  Fixture, runner, both scenario trees and the plugin manifest were frozen for it.
- Only the two throwaway `mkdtemp` profiles of this run received a grant, and only
  for the user-approved pair `@deepseek-ai/dsh-toolkit@0.0.1` × `0.2.2-alpha.2`.
  No production home was touched and no other version was exempted anywhere.
- `GO-loader.txt` had already been consumed (2 lines). It was read, copied verbatim
  into a brand-new `GO-loader.history.20261105T174800Z.txt` (created, never
  overwritten), read back and compared line for line — 2 lines, identical — and only
  then rewritten in place as the strict single line `GO loader`.
- Afterwards the consumption line below was appended, closing the gate again:

  ```
  GO loader
  consumed=yes run_id=20261105T174916Z-tkl-loader-444961-27760 overall_rc=0 reason=passed single_use_authorization_spent=yes both_scenarios_passed exemption_grants_written=2 previous_run=20261105T153714Z-tkl-loader-441797-26138 previous_consumed_backup=GO-loader.history.20261105T174800Z.txt
  ```

## 2. Identity and what actually ran

| Item | Value |
| --- | --- |
| run id | `20261105T174916Z-tkl-loader-444961-27760` |
| unit | `tkl-third-party-loader-20261105T174916Z-444961` |
| run dir | `experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/` |
| mode | `loader` (single mode, no chaining, no retry) |
| workload | `node --max-old-space-size=384 fixture.mjs --out <out>` — plain node, **not** `--test` |
| scenarios | `original` (the as-extracted toolkit tree) then `modified` (`toolkit-rollback-modified/pkg`) |
| launcher rc | `tkl_overall_rc=0` |

## 3. Per-scenario steps actually reached

Both scenarios reached **every** step, in this order (report lines below are quoted
from `out/toolkit-loader-report.txt`):

| Step | original | modified |
| --- | --- | --- |
| link created into the throwaway profile | yes | yes |
| `createRuntimeResolution` (official) | `resolution_entries=634`, `tools_scope=installation` | same |
| resolver contract, canonical comparison | passed | passed |
| **exemption written through the official API** | `granted=yes` | `granted=yes` |
| **readback through the official reader** | `{"@deepseek-ai/dsh-toolkit@0.0.1":["0.2.2-alpha.2"]}`, `rejected_records=0`, `rewritable=true`, `ok=yes` | identical |
| real `boot` of the composed host | reached (the report line after it is the mount probe) | reached |
| **mount** | `row_state=active`, `fiber_present=yes`, `present=10`, `absent=(none)`, `waited_ms=1` | `row_state=active`, `present=10`, `waited_ms=0` |
| tool identities after mount | 10 objects `obj#1..#10` | 10 objects `obj#21..#30` |
| **disable** | `row_state=disposed`, `row_disabled_flag=yes`, `fiber_present=yes`, `remaining=(none)` | same shape |
| **re-enable** | `row_state=active`, `present=10`, `waited_ms=77` | `row_state=active`, `present=10`, `waited_ms=11` |
| tool identities after re-enable | 10 **new** objects `obj#11..#20`, `unchanged=(none)` | 10 **new** objects `obj#31..#40`, `unchanged=(none)` |
| **teardown / dispose** | `teardown=fulfilled` | `teardown=fulfilled` |
| scenario result | `passed` | `passed` |

Summary line: `summary scenarios=2 result=passed`.

Two honest details about that table:

- The disable observation reports `row_state=disposed` **and** `fiber_present=yes`.
  The gate accepts this through the `row_disposed` shape, which the official source
  makes visible (`vendor/loader/src/config/entry.ts:120-142`: on `update()` the
  loader disposes the fiber and leaves the entry in the tree). It is *not* the
  `disabled-with-no-fiber` shape, and the record should not be read as if the entry
  object disappeared.
- `unit.log` still contains `dsh: warning: 20 entries did not activate` plus a list
  of `pending (waiting for service: …)` lines. Those are other profile rows of the
  `headless` template waiting on services this fixture never starts (`fs`, `shell`,
  `workingDirectory`, `subagents`, …). The previous run's decisive line —
  `Plugin @deepseek-ai/dsh-toolkit@0.0.1 is incompatible … Exact-version exemption:
  not active.` — is **gone** from this log, which is consistent with the grant taking
  effect. Neither observation is a statement about the rest of the host.

## 4. Counts and exit codes

- `unit_rc=0`, `overall_rc=0`, `hash_status=identical`, `hash_rc=0`.
- `sandbox_invocation_rc=0`, `node_status=fixture_0_interpreted_as_both_scenarios_passed_source_unverified`,
  `workload_verdict=passed`, run status `result=passed`.
- `source_attribution=not_distinguished_between_bwrap_setup_and_node_workload`: the
  codes are interpretations of one bwrap exit status; no probe was added to split
  sandbox setup from the workload.
- `unit.log`: `Finished with result: success`, `status=0/SUCCESS`,
  `Service runtime: 6.192s`, `CPU time consumed: 2.210s`,
  `Memory peak: 208.8M (swap: 0B)`.

## 5. Envelope (from `toolkit-loader-manifest.txt`)

- cgroup: `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
  `cpu.max=50000 100000`, `cgroup_proof=yes`.
- unit: `Type=exec`, `unit_runtime_max_raw=2min` → `120000000`,
  `unit_memory_max=805306368`, `unit_tasks_max=32`, `unit_proof=yes`.
- gate: `memavailable_gate_kib=1444896` ≥ `required_kib=1228800`, launcher sample once.
- sandbox: `env -i PATH=/usr/bin:/bin HOME=/tmp TMPDIR=/tmp`; `bwrap --ro-bind / /
  --bind <run>/out <run>/out --dev /dev --proc /proc --tmpfs /tmp --unshare-pid
  --unshare-ipc --unshare-uts --unshare-net --die-with-parent`.
- only `<run>/out` is persistently writable; `/tmp` is tmpfs, `/dev` is devtmpfs;
  the run directory is not writable inside the sandbox.
- `network=PrivateNetwork=yes` in the unit and `--unshare-net` in bwrap; routes not
  independently verified.

## 6. Input hashes and checkout pin

`hash_status=identical`, scope `named_set_only_not_closure_not_tree_walk`.

| Input | SHA-256 |
| --- | --- |
| `toolkit-loader/run.sh` | `2b638250b7612ec3d6ee55fa4c54eb4d098ee841ed92f92f8d846746253277ca` |
| `toolkit-loader/payload.sh` | `addbe8fd32be1c8b8c7d3c77383d0dade2a5f3011fde45fc6be216c599d39f88` |
| `toolkit-loader/fixture.mjs` | `dabd744ceea5975c21b7c8ca92f0deeab36d23c815322f7fce6b75ea9c6a124a` |
| original `lib/index.js` | `8f1ea603ac00dfb1cbba715c5b7a4444d9b87c1aa7317a735f7de6e93f684ca5` |
| modified `pkg/lib/index.js` | `952a166d5b3bacc7873427b205d42b46ccd6a7ada846264573394da7467f1a67` |
| modified `pkg/src/index.ts` | `33627fa86d3cd1714b750fcfdd1f9c1a21e161ce2087c97e01bf2898667721c5` |
| checkout `packages/core/tools/package.json` | `da8ee05328d8d0865ab690f4b8cb066e8782f44ed9be679a51859d5e49de7005` |
| checkout `packages/core/tools/lib/index.js` | `1889cbf718d64518dd83245d4dba1e1f080b2c5326259c3ed5b1be7a7666a2bd` |
| checkout `apps/cli/package.json` | `24e6053ed5368db6c17e6524cd2b959e594388205d9ba2d0360cdb0ccd734c88` |

Checkout pin: `expected_pin=actual_head=ce7073d51254c26cd63b22a60835b8f948deb447`,
`rev_parse_rc=0`. It proves **the commit this working tree reports**; it does not
prove the working tree is clean, and it does not cover ignored build output.

## 7. Terminal state and cleanup

```
before_stop load=not-found active=inactive sub=dead main_pid=0 terminal_state=not_found_loadstate_mainpid0
cleanup_action=skipped_already_terminal … reset_failed=not_attempted_by_design
after load=not-found active=inactive sub=dead main_pid=0 after_state=not_found_loadstate_mainpid0 after_terminal_confirmed=yes
unit_unload_guaranteed=no
```

`unit-scan.txt` is not re-read here beyond what the runner recorded; no extra scan
was performed for this record (`unit_unload_guaranteed=no`: a terminal unit proves
the unit ended, not that any plugin cleanup ran).

## 8. What this supports, and what it does not

Supports, for this date and this machine only:

- the official setter wrote a profile-local grant for the approved pair into each
  throwaway profile, and the official reader read back exactly that pair, with no
  rejected records and a rewritable file;
- with that grant in place, the composed host booted the Toolkit row, mounted all ten
  tools, disposed the row on disable, re-mounted all ten (new identities) on
  re-enable, and reported `teardown=fulfilled` — for **both** the original and the
  rollback-modified tree.

  `teardown=fulfilled` means the fixture's dispose call resolved; it does **not**
  prove that every cleanup callback inside the host succeeded, only that nothing was
  raised to the caller. Consistent with that, the unit is still recorded as
  `unit_unload_guaranteed=no`.

  No tool **body** was executed: mount/disable/re-enable observe registration and
  disposal only, so no permission check, sandbox policy or output guard was
  exercised.

Does **not** support:

- any claim of native compatibility: the exemption is a local experimental grant.
  What the host objects to is the **plugin's own declared peer range**, not the
  plugin's version as such: `@deepseek-ai/dsh-toolkit@0.0.1` declares
  `@deepseek-ai/dsh-tools`/`@deepseek-ai/dsh-invariants` `>=0.0.1-rc.1 <0.2.0`, and
  that range does not admit the host's `0.2.2-alpha.2`. The exemption lets this one
  experiment proceed; it does not make the declaration true, and no version
  declaration or manifest was changed;
- anything about the production home, a real user profile, another runtime version,
  another dsh release, another plugin, or another machine;
- anything about tool *execution*: no tool body was invoked (`execute` is not part of
  this fixture), so permissions, sandbox policy and output guards are untested;
- anything about the rest of the host: 20 other rows stayed `pending` on services this
  fixture never starts, and that is unrelated to the Toolkit row;
- closure: only nine named files were hashed, `node_modules` was never traversed.

## 9. Deviations

- The fixtures' grant/readback judges and the exemption code were themselves changed
  earlier in this session (four tightening requirements). This run therefore does not
  reuse the bytes of the previous 72 run: `fixture.mjs` is `dabd744c…` (was
  `856a8bd5…`). The plugin manifest and both scenario trees were not modified.
- No command other than the single authorised run was executed; all evidence above was
  read with file reads. No `bash -n`, no retry, no re-run, no extra probe, no install,
  no build, no `chmod`, no source patch, no resolver shim.
- `out/` was not enumerated by the runner; the report file named above is the only
  workload artifact cited.
- The `/tmp` profiles were left in place; nothing in the production DSH home was read
  or written, and the GUI on 3080 was not touched.

Raw links:
[report](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/out/toolkit-loader-report.txt),
[status](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/toolkit-loader-status.txt),
[verdict](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/verdict.txt),
[manifest](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/toolkit-loader-manifest.txt),
[unit.log](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/unit.log),
[hashes-before](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/hashes-before.txt),
[pin](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/checkout-pin.txt),
[cleanup](/root/dsh-ecosystem-spec/experiments/third-party-pilots/toolkit-loader/runs/20261105T174916Z-tkl-loader-444961-27760/unit-cleanup.txt).

The two earlier Loader results are unchanged and still read as failures:
`2026-11-05-toolkit-loader.md` (refused at the resolver contract) and
`2026-11-05-toolkit-loader-recheck.md` (contract passed, then the row was disabled by
the compatibility gate and nothing mounted).
