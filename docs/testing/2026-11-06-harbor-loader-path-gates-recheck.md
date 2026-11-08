# Harbor real-Loader acceptance — path-gate recheck (executed once)

**Status:** EXECUTED ONCE on 2026-11-06 (local, `+08:00`), under a single explicit
authorization, after the two earlier preflight refusals recorded in
[`2026-11-06-harbor-loader-recheck.md`](2026-11-06-harbor-loader-recheck.md). It reached the
workload: two real hosts, two real loopback listeners, three complete `GET`s per scenario.
55 of 55 assertions passed and the launcher exited `0`.

This is the first execution in this slice that produced any Harbor evidence.
`2026-11-05-harbor-loader.md` (authored, NOT RUN) and the two-refusal record remain unchanged
and are **not** superseded: they are the history of how the slice got here.

## 1. Authorization and command

One authorization, one command, nothing else:

```
bash experiments/third-party-pilots/harbor-loader/run.sh
```

Frozen at launch: `fixture.mjs`, `fixture.test.mjs`, `run.sh`, `payload.sh` and the two
comparison trees. No pre-run, no second command, no install, no build, no network
configuration, no `ip link`, no retry, no limit change, no `POST`, no GUI port, no
production profile.

## 2. Identity

| Item | Value |
| --- | --- |
| run id | `20261105T183741Z-hbl-446295-12509` |
| unit | `hbl-20261105T183741Z-446295` |
| hub pin | `9465c9fb36d753ae66d45a6617e4d51db8163df9` |
| checkout pin (one read-only `git rev-parse HEAD`) | `ce7073d51254c26cd63b22a60835b8f948deb447`, `rc=0` |
| started / finished (UTC) | `2026-11-05T18:37:41.878Z` / `2026-11-05T18:37:47.558Z` |
| local equivalent | `2026-11-06 02:37:41` / `02:37:47` `+08:00` |
| node | `v24.21.0`, `--max-old-space-size=384` |

The checkout pin is a claim about the **commit only**; it does not prove the working tree,
ignored/untracked files, or the built `lib/` outputs that were actually loaded.

## 3. What ran

Both trees went through the real `app-boot` `boot()` and the real Cordis Loader, as ordinary
overlay rows, against the built `WebServer` class from the pinned checkout. One host at a
time, serial: `original` finished with a confirmed teardown before `modified` started
(`notRunScenarios: []`).

| Scenario | hub bytes loaded | sha256 | listener |
| --- | --- | --- | --- |
| `original` | 14757 | `415adf3b0cc015da7ed5b6ede9b2ef4fa5d21e9fa9aa26cda607575a8714947d` | `http://127.0.0.1:33491` |
| `modified` | 15582 | `31274e7484165adb1f79d2c91585f836274843068758c6b2b5ba4e9e8c1cdb58` | `http://127.0.0.1:35657` |

Sequence per scenario, all observed: webserver row `active` → hub row `active` →
`GET /_dsh/dsh-harbor/ping` → Loader `entry.update({ disabled: true })` → hub row
`disposed` → webserver row still `active` and the listener unchanged → `GET` again →
`entry.update({ disabled: null })` → hub row `active` again → `GET` again → teardown.

| Probe | `original` | `modified` |
| --- | --- | --- |
| after mount | **200**, complete, 258 bytes | **200**, complete, 258 bytes |
| after hub stop | **404**, complete, 0 bytes | **404**, complete, 0 bytes |
| after reload | **200**, complete, 258 bytes | **200**, complete, 258 bytes |

Both 200s carried `{"ok":true,"service":"dsh-harbor","routes":{"expected":6,"mounted":[…six
paths…],"failed":[]}}`. Both 404s carried an empty body. `complete: true` on every probe means
the message itself was whole — a truncated or aborted 404 is not counted as evidence that the
route was gone.

## 4. Assertions

`records.json` reports `summary.total = 55`, `passed = 55`, `failed = 0`,
`failedIds: []`, `missingAssertionIds: []`, `notRunScenarios: []`. That is the fixed catalog
of **27 ids per scenario** (25 before `hub_path_gate` and `hub_entry_config_name` were added)
times two scenarios, plus `matrix.assertions_complete`. No id is duplicated.

The two gates that this recheck exists to exercise both held:

- `hub_path_gate` (per scenario) — the path handed to the overlay is absolute, `realpath`s to
  the fixed target for that scenario, and its digest was read, **before** any host was
  booted.
- `hub_entry_config_name` (per scenario) — the row's configured specifier equals
  `pathToFileURL(hubPath).href` exactly.

**Scope of `hub_entry_config_name`.** It compares the row's *configured* value
(`entry.options.name`, the string app-boot rewrote to a `file:` URL). No public row field
carries a resolved or executed URL, so this is **configuration identity, not proof of the
executed URL**: an alternative specifier, a re-export, or a symlinked path that reaches the
same file is outside what it observes. The record says exactly this in each scenario.

## 5. Envelope, capacity and metrics (read back inside the unit)

| Knob | Applied (cgroup readback) | Unit property |
| --- | --- | --- |
| memory | `memory.max = 805306368` | `MemoryMax=805306368` (768M) |
| swap | `memory.swap.max = 0` | `MemorySwapMax=0` |
| tasks | `pids.max = 32` | `TasksMax=32` |
| cpu | `cpu.max = 50000 100000` | `CPUQuota=50%` |
| type / runtime | — | `Type=exec`, `RuntimeMaxUSec=120000000` |

`acc_capture_ok=yes`; the single capacity gate passed (`MemAvailable 1378516 KiB` ≥
`1228800 KiB`). `acc_runtime_usec_numeric=<unavailable>` — `busctl` returned nothing and the
value above comes from `systemctl show`, so it is recorded as a resolved property, not as a
bus readback. `acc_metrics_complete=yes`: `memory.peak=215658496`,
`memory.current=95522816`, `pids.peak=14`, `memory.events.local` all `0`. systemd's own
journal summary agrees: `2.370s CPU time, 205.6M memory peak`. Workload wall time
`6262 ms`. Post-run `systemctl` defaults are **not** the applied caps; the in-unit readback is
the evidence.

## 6. Sandbox and network scope

`--unshare-net` was applied (`acc_bwrap` records it). Inside that private namespace the
fixture bound `127.0.0.1:0` and used the OS-assigned port; the fixture's own target gate
(`http:`, `127.0.0.1`, explicit port 1..65535, not 3080, no credentials, no query/fragment,
fixed `/ping` path) still applied inside the namespace. No host network, no host loopback
service, no `ip`/`ifconfig`, no `lo` manipulation, no host-netns fallback, no GUI port. The
read-only root can still read real home paths, and `env -i` is not read isolation: this is a
bounded sandbox, not a security boundary.

## 7. Teardown and final state

Per scenario: `hub_stop_on_teardown` passed (the active row was stopped once) and
`host_teardown_fulfilled` passed with `settled: 'fulfilled'`. **That fulfilled promise is
about the host teardown settling, never about the plugin's cleanup scope closing cleanly** —
the Loader catches a rejecting cleanup and only logs it
(`vendor/cordis/src/fiber.ts:712-730`), so the two are not the same claim.

The runner never needed to stop a unit itself (`cleanup_stop=not_attempted`,
`cleanup_verdict=clean` because the unit was already gone). Single post-workload query,
`query_rc=0`: `LoadState=not-found`, `ActiveState=inactive`, `MainPID=0`. Twelve unit
families were checked for active units before launch (`hbl-*`, `tkl-*`, `harbor-*`, `lfx-*`,
`rbk-*`, `tkb-*`, `cpy-*`, `exc*`, `acq*`, `p0*`, `acc*`, `admission*`), all `query_rc=0`
with no output. `journal_rc=0`, `journal_status=collected`, four lines, no per-unit TAP in
journald (the TAP lives in `unit.log`).

## 8. Hash scope

Eleven named files, `hash_status=identical`, no `hashes-diff.txt`:

```
08059fd3…  fixture.mjs
a41c3f8d…  fixture.test.mjs
be6b91a3…  run.sh
4b3e35c8…  payload.sh
ed5c23f9…  managed-cleanup/lib/host.mjs
92545b22…  managed-cleanup/lib/layout.mjs
81a85ab6…  build-checkout/packages/host/webserver/lib/index.js
60abcaf2…  build-checkout/packages/boot/app-boot/lib/index.js
415adf3b…  original hub (14757 B)
31274e74…  modified hub (15582 B)
5fab080e…  projects/dsh-plugin-kit/src/cleanup.js
```

The scope is those named files only — it is **not** a transitive closure, and stability of
these bytes during the run is not a statement about the rest of either tree.

## 9. Exit codes

| Code | Value | Meaning here |
| --- | --- | --- |
| launcher (`run.sh`) | `0` | acceptance exit |
| `systemd-run.rc` | `0` | unit started and waited |
| `journal.rc` | `0` | journal collected |
| `acc_node_rc` | `0` | fixture workload |
| `acceptance_exit` | `0` | final aggregate |

`workload_rc_provenance=source_unverified`: `0` means "no failure claimed" — the outer
`systemd-run`/`timeout`/`bash`/`bwrap` layers can return the same small integers, and no
probe adds attribution.

## 10. Deviations and limits of this record

- **A README/launcher comment is now inaccurate and was deliberately not edited.**
  `run.sh:307-319` still describes the pre-boot check as a digest record. The fixture now
  applies `hubPathGate` as a **hard refusal before boot**, so the launcher's comment
  understates the enforcement. It was left byte-for-byte as executed rather than edited after
  the fact; this section is where the real behaviour is stated.
- **Two earlier preflight refusals stand.** This attempt is the third authorization and the
  first that ran; the earlier `rc=70` and `rc=71` records are unchanged and still contain no
  evidence.
- **An authoring deviation predates this run** (recorded in §8 of
  [`2026-11-06-harbor-loader-recheck.md`](2026-11-06-harbor-loader-recheck.md)): one rewrite of
  `fixture.mjs` used a shell heredoc instead of the file tools. The bytes that ran are the
  bytes recorded in §8 above; the deviation is about how they were authored, not about what
  they did.
- `fixture.test.mjs` (the mocked control-flow tests) was **not run by this host run**. It is
  not evidence for this run, and this run is not evidence for it. Unit-level evidence for
  that file exists separately: the `loader-fixture-unit` run
  `20261105T183234Z-lfx-unit-446047-24852` executed it once with 83/83 (Harbor 41,
  Toolkit 42), recorded in
  [`2026-11-06-harbor-path-gates-unit.md`](2026-11-06-harbor-path-gates-unit.md). Those 83
  assertions are that record's, not part of this run's 55, and they were not observed here.
- Nothing here exercises `POST /preflight`, `/report`, `/updates`, the same-origin browser
  guards, the `notify`/client build, the install/publish form, or a second concurrent host.

## 11. What this does and does not mean

**Does mean.** On this host, with this pinned checkout, the real `app-boot` + real Cordis
Loader accepts both the upstream hub and the modified hub as overlay rows; the real built
`WebServer` binds a loopback ephemeral port in a private network namespace; each hub's six
routes are genuinely in that service's route table (the 200 body lists them and reports
`failed: []`); Loader-stopping the row retracts them (complete 404) while the webServer row
and its listener survive unchanged; reloading the row restores all six; the configured row
specifier matched the handed file URL in both cases; and both hosts tore down to
`not-found`/`MainPID=0` inside an attested 768M/0-swap/32-task/50%CPU/120s envelope.

**Does not mean.** It does not mean the Harbor `dsh-harbor` pilot is "approved" beyond this
fixture's claims; it does not mean the `cleanup` seam behaves identically under a real
Loader to what the fake-host comparisons showed (those remain separate, fake-host evidence);
it does not mean the two trees are identical outside the eight compared modules; and it does
not mean a fulfilled host teardown equals a clean plugin cleanup.

## 12. Evidence

Run directory:
`experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/`

- [`status.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/status.txt)
- [`unit.log`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/unit.log)
- [`argv.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/argv.txt)
- [`unit-preflight.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/unit-preflight.txt)
- [`hashes-before.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/hashes-before.txt)
- [`hashes-after.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/hashes-after.txt)
- [`journal.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/journal.txt)
- [`unit-state-after_workload.txt`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/unit-state-after_workload.txt)
- [`out/records.json`](../../../../experiments/third-party-pilots/harbor-loader/runs/20261105T183741Z-hbl-446295-12509/out/records.json)

`hashes-diff.txt` and `unit-state-after_cleanup_stop.txt` do not exist for this run: hashes
matched, and no stop was needed.