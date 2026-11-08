# Harbor modified stage (kit cleanup seam) — executed once (2026-11-05)

**Status: EXECUTED ONCE on 2026-11-05 under an explicit Lead GO — §6 is the execution
record.** Unlike the baseline entry, this document was written *after* its single run,
so it has no NOT RUN history to preserve: it reports what the records say, and nothing
that the records do not contain.

This slice is **not** a plugin fix, **not** an install and **not** Loader evidence. It
measures one delta between a pinned third-party plugin and a copy of it whose cleanup
seam has been re-expressed with the kit's `createCleanupScope`, both driven through the
same fake host in one process.

## 1. Why this entry exists

The baseline entry (`2026-11-05-harbor-baseline.md`) measured the pinned original alone.
That says what upstream does, but it cannot describe a **delta**. This entry does: the
original and the modified copy are loaded together and driven through the same fake host,
so the two trees are observed through one driver. That is a shared driving path, not a
guarantee that every difference reported belongs to the two source trees alone — the fake
host, the fixtures and the assertions written for this slice all shape what can be seen,
and anything they do not exercise is not observed.

## 2. Artefacts

| path | role |
|---|---|
| `experiments/third-party-pilots/harbor-modified/pkg/` | the copy: 20 files (18 modules + `LICENSE` + `package.json`), from one authorised copy run whose evidence is `experiments/third-party-pilots/copy-prep/runs/20261104T201005Z-cpy-harbor-415550-19863/out/evidence` (the 199720 bytes recorded there are the **pre-modification** copy snapshot, not the current tree total) |
| `experiments/third-party-pilots/harbor-modified/pkg/src/hub/index.mjs` | the only file that differs from upstream **among the eight module pairs this test compares** (382 → 387 lines); the wider tree was not compared file by file |
| `experiments/third-party-pilots/harbor-modified/compare.test.mjs` | same-run comparison of the two trees |
| `experiments/third-party-pilots/harbor-modified/run.sh` | host launcher: one transient unit, one workload, one attempt |
| `experiments/third-party-pilots/harbor-modified/payload.sh` | in-unit payload: envelope readback, one capacity gate, then the workload |
| `experiments/third-party-pilots/harbor-modified/NOTICE.md` | what was changed and what is not claimed |
| `experiments/third-party-pilots/harbor-modified/README.md` | contract, hash coverage, boundary |
| this document | the execution record |

## 3. Pin, provenance, licence

- Repo `https://github.com/ZSeven-W/dsh-harbor` — independent third party, **not** an
  official `deepseek-ai` bundled package.
- Commit `9465c9fb36d753ae66d45a6617e4d51db8163df9` (`main` HEAD, 2026-11-04T10:01:50Z),
  taken from `commits/main.atom`.
- Package `@zseven-w/dsh-harbor` `0.1.0-rc.4`.
- MIT, `Copyright (c) 2026 ZSeven-W`, evidenced by the upstream `LICENSE` file text
  rather than `package.json` metadata. The `LICENSE` file is copied unchanged into
  `pkg/`; the modification is additional work under the same licence, not a relicense.
  Both licence and source were read as decoded text, so no byte-for-byte claim is made
  for the upstream originals — only the copy's own hashes are recorded here.
- The test imports the original by a path that embeds the commit id, so the choice of
  tree is fixed and cannot drift silently to another checkout. It does **not** prove the
  bytes at that path are the bytes of that commit: the hash pair in §6 verifies that the
  selected files stayed stable across this run, not that they match upstream, and it is
  not a defence against every possible replacement.

## 4. The modification (unchanged from the frozen design)

In `pkg/src/hub/index.mjs` only:

1. `import { createCleanupScope } from '../../../../../../projects/dsh-plugin-kit/src/cleanup.js'`
   — the real kit implementation.
2. `const cleanup = createCleanupScope({ label: 'dsh-harbor routes' })` replaces
   `const disposers = []`.
3. The `once(dispose)` wrapper — the one that caught and discarded a throwing disposer —
   is deleted.
4. `if (typeof dispose === 'function') cleanup.defer(dispose, { label: 'route:' + route.path })`.
5. The returned unmount resets the caches once, then `return cleanup.close()`.

Untouched: the six route paths and `/_dsh/dsh-harbor` prefix, `MAX_BODY_BYTES` 4096,
`REPORT_CACHE_TTL_MS` 60_000, the loopback and same-origin guards, the `sendJson`
headers, the partial-mount warning, the `/ping` 503 shape, all four preflight routes
including the POST, and the `mountHub`/`apply` signatures.

## 5. Cases, and what the record shows

Six tests, all reported `✔` by the runner. The upstream column is observed in the same
process, so both columns come from one run.

| # | case | upstream (pinned) | stage copy |
|---|---|---|---|
| 1 | identity | `name`, `inject` | same |
| 2 | normal teardown | six routes retracted, reverse mount order, exactly once | same, and the unmount's value is a promise this test awaits |
| 3 | disposer throws before retracting | error swallowed, that route stays mounted, others continue, unmount returns `undefined` | `AggregateError` with `ERR_CLEANUP_SCOPE_FAILED`, `errors[0]` is the same thrown value, remaining disposers still run, that route **also** stays mounted |
| 4 | asynchronous disposer | not awaited; unmount returns `undefined` immediately | not settled until the disposer settles; route retracted only after the gate opens |
| 5 | repeated / reentrant unmount | repeated call returns `undefined` again | repeated call returns the same promise; a call from inside a disposer sees that same promise without awaiting itself |
| 6 | partial mount, guards, no `webServer` | 5/6 + warning + `/ping` 503; 403 `loopback only`; 405 + `allow`; 403 same-origin; degraded no-op | identical, asserted in the same test body |

Case 3 is the honest limit of the change: a disposer that throws **before** retracting
leaves its route mounted in **both** trees. The copy makes the failure visible; it does
not release the route, and no assertion here claims it does. Nothing here fixes the
plugin's underlying disposer or route isolation.

## 6. Execution record

**Authorization.** One explicit single-run GO: one invocation of the launcher, no prior
`node`, no prior `bash -n`, no extra probe, no install, no build, no network, no Loader,
no Toolkit run, no change to `pkg/`, to the test, to either runner, to the pinned
original or to the copy evidence. Frozen before the run; one run only, no retry.

```
command : bash experiments/third-party-pilots/harbor-modified/run.sh
started : 2026-11-04T20:26:51Z UTC = 2026-11-05 04:26:51 +08:00
run dir : experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/
unit    : harbor-modified-20261104T202651Z-416012.service
pin     : 9465c9fb36d753ae66d45a6617e4d51db8163df9
```

**Three distinct exit codes — not interchangeable.**

| code | value | meaning |
|---|---|---|
| `node --test` rc (in unit, `acc_node_rc`) | **0** | the runner reported no failing test |
| `systemd-run` rc (`systemd-run.rc`) | **0** | the unit's own exit status was 0 |
| launcher acceptance rc | **0** | records intact, inputs identical, unit clean, envelope attested |

**TAP counts, as printed by the runner (not by this document).** `tests 6`, `suites 0`,
`pass 6`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 216.824806`;
workload wall `acc_workload_wall_ms=524`; service runtime 662 ms; CPU time consumed
253 ms; manager-reported memory peak 60.1M, swap 0B. The six `✔` names: `identity`,
`normal teardown`, `a disposer that throws before retracting`, `an asynchronous
disposer is observed`, `repeated unmount`, `partial mount, guards and the absent-webServer
path`.

**Baseline comparison — 8 vs 6 is not a regression.** The baseline entry recorded
`tests 8 / pass 8` for a *different file* (`baseline.test.mjs`, which has separate guard
and no-`webServer` tests). This slice's file splits that work differently (guards and the
degraded path live inside case 6) and adds the shared/reentrant case. The two counts
measure different test files and must not be added, subtracted or compared as a trend.
The baseline's 8/8 is historical context only.

**Envelope, from the in-unit readback** (`unit.log`; post-run `systemctl` defaults are
not the applied caps): cgroup `memory.max=805306368`, `memory.swap.max=0`, `pids.max=32`,
`cpu.max=50000 100000`; unit `Type=exec`, `MemoryMax=805306368`, `MemorySwapMax=0`,
`TasksMax=32`, `RuntimeMaxUSec` resolved to `120000000` (`acc_unit_runtime_max=2min`).
`acc_capture_ok=yes`, `acc_gate=pass` (`MemAvailable=1426628 KiB >= 1228800 KiB`).
`acc_runtime_usec_numeric=<unavailable>` — `busctl` returned nothing on this host and the
value came from the `systemctl` readback; recorded as a field, not a failure, exactly as
in the baseline run.

**In-unit accounting**: `memory.peak=63098880`, `memory.current=31158272`,
`pids.peak=16`, `memory.events.local` all zero, `acc_metrics_complete=yes`.

**Provenance.** `hashes-before.txt` and `hashes-after.txt` are byte-identical (`diff -q`
clean, no `hashes-diff.txt`), over **20 named files**:

```
6cf408ea…  compare.test.mjs
d9664313…  run.sh
146f50f6…  payload.sh
5fab080e…  projects/dsh-plugin-kit/src/cleanup.js
415adf3b…  <pinned>/src/hub/index.mjs          c12cb344…  <pinned>/src/hub/freshness.mjs
1ac2b3d1…  <pinned>/src/hub/preflight-job.mjs  a74b9d76…  <pinned>/src/scan/index.mjs
65f617eb…  <pinned>/src/scan/runtime.mjs       ccb9a627…  <pinned>/src/scan/discover.mjs
900ac193…  <pinned>/src/preflight/index.mjs    6d7962ca…  <pinned>/src/preflight/host.mjs
31274e74…  pkg/src/hub/index.mjs  (the one modified file)
c12cb344…  pkg/src/hub/freshness.mjs           1ac2b3d1…  pkg/src/hub/preflight-job.mjs
a74b9d76…  pkg/src/scan/index.mjs              65f617eb…  pkg/src/scan/runtime.mjs
ccb9a627…  pkg/src/scan/discover.mjs           900ac193…  pkg/src/preflight/index.mjs
6d7962ca…  pkg/src/preflight/host.mjs
```

Two facts follow directly from these hashes: within the **eight compared module pairs**,
the stage hub (`31274e74…`) differs from the pinned hub (`415adf3b…`) and the other seven
stage modules are byte-identical to their upstream counterparts. That is consistent with
exactly one file having been changed, but it does not prove the whole copy is otherwise
untouched: only these eight pairs were hashed, and the remaining modules of the copy were
not compared file by file.

This list is **not** a transitive closure. `pkg/src/scan/evidence.mjs`,
`inspect.mjs`, `conflicts.mjs`, `snapshot.mjs`, `manifest.mjs`, `detectors.mjs`,
`versions.mjs`, `preflight/checks.mjs`, `preflight/pack.mjs` and `preflight/semver.mjs`
are in the copy but **not** hashed, and a change confined to one of them would not be
caught by the hash pair. The client build is not in this 20-file subset at all — it was
never copied (the subset is `src/` plus `LICENSE` and `package.json`), so it is
**uncovered** rather than "in the copy and unhashed".

**Terminal state**: pre-launch unit-table query covered all seven families
(`harbor-modified`, `harbor-baseline`, `exc`, `acq`, `p0`, `acc`, `admission`) in
`active,activating,reloading,deactivating` with `query_rc=0` and found nothing active.
Exactly one unit-state query was made — `unit-state-after_workload.txt`, `query_rc=0`,
`LoadState=not-found`, `ActiveState=inactive`, `MainPID=0`. No stop was executed
(`cleanup_stop=not_attempted`), so no second query exists and there is no
`unit-state-after_cleanup_stop.txt`; `status.txt`'s `unit_state_first` and
`unit_state_final` are the same single observation, classified `cleanup_verdict=clean`.
`journalctl` rc 0, `journal_status=collected` (three journald lines: Starting / Started /
Deactivated successfully; no per-unit TAP in the journal). `record_failures=none`.

Raw records for this run (relative to this file):
[run directory](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/) ·
[status.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/status.txt) ·
[unit.log](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/unit.log) ·
[argv.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/argv.txt) ·
[unit-preflight.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/unit-preflight.txt) ·
[hashes-before.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/hashes-before.txt) ·
[hashes-after.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/hashes-after.txt) ·
[journal.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/journal.txt) ·
[unit-state-after_workload.txt](../../../../experiments/third-party-pilots/harbor-modified/runs/20261104T202651Z-harbor-modified-416012-1980/unit-state-after_workload.txt)

(No `hashes-diff.txt` and no `unit-state-after_cleanup_stop.txt` exist for this run — both
would be produced only under the conditions named in §6.)

## 7. What this run shows, and what it does not

Shows:

- With the kit's scope in place, a throwing synchronous disposer is **no longer silent**:
  the copy rejects with `AggregateError`/`ERR_CLEANUP_SCOPE_FAILED`, keeps the original
  error object as `errors[0]`, and still runs the remaining disposers — observed in the
  same process as the upstream tree, which swallowed the same error and returned
  `undefined`.
- An asynchronous disposer is now awaited: the unmount settles only when the disposer
  does, where upstream returned immediately.
- Repeated unmounts share one settlement instead of returning `undefined` each time, and
  a reentrant call sees that settlement without deadlocking on itself.
- Registration, partial-mount, `/ping` 503 shape, the loopback and same-origin guards, the
  degraded no-`webServer` path, and the six route paths are unchanged.

Does not show:

- **No Loader**: no real Cordis Loader ran, no profile patch line was loaded, and nothing
  is inferred about what a host does with the value `mountHub()` returns. The only source
  facts used are the exact signature `export async function apply(ctx)` and that the
  upstream seam returns `undefined` synchronously.
- **No real route**: the fake host keeps routes in a plain `Map`. No listener, socket or
  port exists, so "a route stays mounted" is a map entry, not a web-route leak in a host.
  The test never issues `/preflight` POST (`preflightJobs.start` is a tripwire).
- **No fix to the underlying disposer**: a disposer that throws before retracting leaves
  its route mounted in both trees.
- **No offline proof**: `--unshare-net` isolates the namespace but does not prevent a bind
  inside it. That no listener exists is a property of this test, not of the sandbox.

## 8. Deviations and limits of this record

- `acc_runtime_usec_numeric=<unavailable>`: `busctl` produced nothing; the `systemctl`
  readback supplied `120000000`. Recorded, not treated as a failure. Same behaviour as
  the baseline run.
- The journal holds three lines and no per-unit TAP copy; the in-unit `unit.log` is the
  primary TAP record and the journal is corroboration only.
- Hash coverage is a fixed 20-file list, not a closure (see §6). No directory walk was
  performed to widen it, by design.
- The stage tree is a **subset fixture**, not a publishable package: `package.json` is
  copied verbatim, so `exports['./client']` → `./lib/client.js`, `bin.harbor` →
  `./src/cli.mjs` and `dsh.bundle.patch` → `./cordis.patch.yml` do not exist here.
- Read-only mounts protect integrity, not confidentiality: the workload could still read
  real files, including a real home directory. `env -i` with `HOME=/tmp` removes
  environment inheritance, not read access.
- Nothing in this run changes `projects/dsh-plugin-kit/src/`; the kit module was an input,
  hashed before and after.
