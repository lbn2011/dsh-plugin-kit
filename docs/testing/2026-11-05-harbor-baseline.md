# Harbor baseline (pinned original) — NOT RUN, then executed once (2026-11-05)

**Status: EXECUTED ONCE on 2026-11-05 under an explicit Lead GO — see §10 for the
result.** The NOT RUN state described below is **historical and preserved**: this entry
was authored under a CODE-ONLY authorization (no command, no test, no install, no run),
and at that time it contained no pass counts, no assertion totals, no timings and no
observations. Everything §1–§9 says about the design as authored still stands; §10 is the
appended execution record and is the only part of this file that reports what actually
happened. Nothing here may be cited as evidence that the plugin works in a real Loader:
the workload runs against a fake host.

## 1. Why this entry exists

The third-party pilot needs a reference point for teardown and registration
behaviour that is measured against the **original** plugin rather than assumed. The
kit's `createCleanupScope` aggregates disposer failures and awaits asynchronous
disposers; the original `dsh-harbor` hub does neither. Without a baseline of the
original, that difference could not be described as a delta — only as an opinion.
So the baseline is written first, from source, and left unexecuted until a bounded
run is authorized.

This entry covers **only** the original. It does not cover the adapted slice or a
harness wrapper, and it makes no host-compatibility claim. A planned execution entry
point exists (§9) but has never been executed.

## 2. Artefacts

| path | role | executed as authored |
|---|---|---|
| `experiments/third-party-pilots/harbor-baseline/baseline.test.mjs` | fake-host baseline of the pinned original | no (run later — §10) |
| `experiments/third-party-pilots/harbor-baseline/run.sh` | host-side launcher: one transient unit, one workload | no (run later — §10) |
| `experiments/third-party-pilots/harbor-baseline/payload.sh` | in-unit payload: envelope readback, one capacity gate, one `node --test` | no (run later — §10) |
| `experiments/third-party-pilots/harbor-baseline/README.md` | provenance, injection boundary, open items | no (document only) |
| `projects/dsh-plugin-kit/docs/testing/2026-11-05-harbor-baseline.md` | this record | no (this document) |

No adapted variant and no extra fixture was added. `run.sh` and `payload.sh` are the
execution entry point sketched in §9; they add no new extraction and modify nothing
under `extract/`. They were unexecuted when this section was written; the one authorized
execution is recorded in §10.

## 3. Pin and provenance

- Repo `https://github.com/ZSeven-W/dsh-harbor` — independent third party, **not** an
  official `deepseek-ai` bundled package.
- Commit `9465c9fb36d753ae66d45a6617e4d51db8163df9` (`main` HEAD, 2026-11-04T10:01:50Z,
  `board: DSH 0.2.2-rc.1 probe results`), taken from the repository's
  `commits/main.atom` feed.
- Package `@zseven-w/dsh-harbor` `0.1.0-rc.4`.
- Imported original (workspace-relative, 382 lines):
  `experiments/third-party-pilots/extract/runs/20261104T183510Z-exc-harbor-412432-5819/out-harbor/dsh-harbor-9465c9fb36d753ae66d45a6617e4d51db8163df9/src/hub/index.mjs`
- The import specifier embeds the commit id, so a different tree cannot be imported
  silently.

**Licence retention.** The extracted packet stays unmodified and in place; it is not
copied into the pilot folder and not rewritten. MIT, `Copyright (c) 2026 ZSeven-W`,
evidenced by the upstream `LICENSE` file text rather than `package.json` metadata. Any
future quotation of original source into a doc must carry that notice. Limit: both
licence and source were read as decoded text, so no byte-for-byte claim is made.

## 4. What the baseline is designed to show (design, not result)

Source lines referenced are from the pinned file above.

| # | case | original behaviour referenced |
|---|---|---|
| 1 | normal cleanup | six routes registered in `ROUTE_PATHS` order (`:19-26`), teardown reverse, returns `undefined` (`:370-377`) |
| 2 | throwing **synchronous** disposer | error swallowed inside `once()` (`:221-228`); remaining disposers still run, and the failing route is **left mounted** because the throw precedes any retraction — recorded as observed semantics, explicitly **not** a defect |
| 3 | **asynchronous** disposer | not awaited: `once()` calls `dispose()` and ignores the returned value, so five routes are retracted while one is still mounted when teardown returns; retraction happens on latch settlement. Proven with a self-settled latch, never a sleep, and always drained in `finally` |
| 4 | repeated cleanup | guard flag `disposed` (`:370`); no disposer re-runs; each call returns the original's own value, not a shared settlement |
| 5 | one failed registration | `register()` catches per route (`:248-260`); five of six stay mounted; `/ping` returns `503` with `routes.{expected,mounted,failed}` (`:262-277`) |
| — | guard negatives | loopback peer + loopback `Host` (`:44-84`), same-origin `sec-fetch-site`/`origin`/`referer` (`:99-118`), `405` + `allow` (`:230-246`), hardened response headers (`:120-131`) |
| — | missing `webServer` | warn + no-op disposer (`:201-209`) |

Cases 2 and 3 are **capability boundaries of the original**, listed outside any
pass/fail expectation. They are not acceptance criteria for the adapted slice, and
the baseline must not "fix" them.

### 4.1 Fake-host retraction semantics

The fake host is scaffolding authored here, not a model of a real host. Its
retraction rule is stated so the assertions can be checked against it: a disposer
that returns normally retracts its route and returns `undefined`; a disposer that
throws before retraction leaves its route mounted (the pinned `once()` swallows the
error); a disposer that returns a promise retracts its route only when that promise
settles. Invocations are recorded once each, in call order, so identity and
ordering are asserted independently of the resulting route set. Registration
failure is modelled as a throw from `register()`, so a route that never mounted is
never retracted.

Three clarifications, because this semantics is easy to over-read:

- A "route" here is an entry in a `Map` owned by the test — not a listener, not a
  socket, not a bound port. A route reported as still mounted exists only in that
  `Map`.
- Case 2's residual route is intentional. The `finally { dispose() }` guard in the
  mounted cases is an assertion-abort guard for *other* state, not a reclaim step: the
  second `dispose()` is a no-op in the original, so it does not retract the route the
  throwing disposer left behind, and this baseline does not force it to.
- Case 3's route disappears only because the test settles its own latch and the fake
  host deletes the entry then — not because the original awaited anything.

## 5. Dependency-injection boundary

`mountHub(ctx, dependencies)` resolves thirteen ports (`:181-196`). The baseline
injects every one of them with fixed data, so no path performs a filesystem read, a
`HOME` lookup, a network request or a subprocess spawn: `scan`, `checkUpstream`
(throws if called), `collectRuntimeSurface`, `attributeSurface`, `fingerprintSource`,
`readClientBuildId`, `now`, `rootDir` (a string path, never created),
`listHostVersions` (throws if called), `listCachedHosts`, `currentHostVersion`,
`preflightJobs` (fake; `start()` throws and is asserted never invoked), `profile`.

Three statements that must travel with any citation of this slice:

- The bound comes from the injection, **not** from the manifest. "No npm
  dependencies" is not "zero side effects".
- Non-injectable module imports (`validTarget`, `profilesDir`,
  `installedHostVersion`, `node:path`, `node:url`) are evaluated when the module is
  imported, not lazily on the `/preflight` POST path; injection cannot skip that
  evaluation. The POST path only *calls* them, and this baseline never issues it —
  the `preflightJobs.start()` assertion is the tripwire.
- Injection is a **behavioural** boundary, not a security sandbox. Confinement, if
  wanted, is a property of the sandbox the run happens in.

## 6. Evidence class

The fake host is **evidence about source behaviour, not a real Loader**. No listener
is created, no socket opened, no request sent, no child process started. "No network"
here means *this test never creates or needs a listener or a request*; it is a property
of the test, not a guarantee that a sandboxed process could not bind a socket inside its
own network namespace. The intended run belongs in an offline sandbox, and that offline
property belongs to the run environment rather than being proven by the injection or by
the flags. Host compatibility remains the job of the real-Loader evidence layer, and a
fake-host result would not constitute a pilot proof.

## 7. Envelope reserved for a later authorization (unused)

One serial invocation, no retry: `MemoryMax 768 MiB`, `swap 0`, `Tasks 32`,
`CPUQuota 50%`, `exec 120 s`, Node heap `384 MiB`, gate `1200 MiB`. Nothing has been
run under it.

## 8. Decisions already taken by Lead

1. Case 2 (swallowed synchronous disposer error, route left mounted) stands as
   **baseline behaviour of the original**. If the adapted slice later aggregates
   disposer errors through `createCleanupScope`, that difference is recorded as a
   documented divergence — never as a baseline bug, and this file is not
   retro-fitted.
2. The guard-negative block stays in `baseline.test.mjs` and is the **single**
   coverage of those semantics; the adapted-slice matrix must not repeat the same
   assertions, and the two documents are never summed into one count.
3. `/preflight` POST gets **no** case in this slice, since the pilot excludes
   subprocess work.

No open items remain. Nothing in this record has been executed.

## 9. Planned execution entry point (NOT RUN, no GO yet)

`bash experiments/third-party-pilots/harbor-baseline/run.sh` — no arguments, and no
configuration taken from the environment: what runs and how much resource the unit gets
are literals in the script. (That is a statement about the launcher's inputs, not a
claim that its own environment is sanitised.)

**Launcher (host side).** Refuses if `node`, `bwrap`, the payload, the test file or the
pinned original is missing (a missing original is a refusal, never a skip); reads the
pin strictly out of `baseline.test.mjs` (`SOURCE_PIN`, also embedded in the import
specifier), requiring exactly one declaration and agreement with both the extraction
directory name and the import line; takes the shared
`experiments/acceptance/runs/.acceptance.lock` exclusively (held → refusal, never a
wait); queries the unit table for **every family this repository has used**
(`harbor-baseline`, `exc`, `acq`, `p0`, `acc`, `admission`) in states
`active,activating,reloading,deactivating`, checking each query's own rc and refusing if
any such unit exists; creates an exclusive run directory; **writes and verifies
`argv.txt` before launching** (a failed argv record means no launch); hashes inputs
before and after, file by file; performs one `systemd-run` launch; collects journal,
unit state, metrics and hashes; writes `status.txt` last.

**Unit envelope.** `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`,
`CPUQuota=50%`, `RuntimeMaxSec=120`.

**Payload (in unit).** Before any work it reads the effective cgroup knobs and the
unit's own `Type` / `MemoryMax` / `MemorySwapMax` / `TasksMax` / `RuntimeMaxUSec` and
refuses unless every value matches; one single-shot gate requires
`MemAvailable >= 1228800 KiB`. No polling, no retry, no escalation, one workload only.
It then runs one `bwrap` sandbox — `--ro-bind / /`, fresh `--tmpfs /tmp`,
`--bind <run>/out <run>/out`, `--unshare-pid --unshare-net --unshare-ipc
--unshare-uts --die-with-parent`, `env -i` with `PATH`, `HOME=/tmp`, `TMPDIR=/tmp`,
`NODE_OPTIONS=--max-old-space-size=384` — and exactly one
`node --max-old-space-size=384 --test --test-concurrency=1 baseline.test.mjs`. While
still inside the cgroup it records `memory.peak`, `memory.current`, `pids.peak`,
`memory.events.local` and sets `acc_metrics_complete=no` if any of them is unreadable.

**What that sandbox is not** — the part most easily over-read:

- `--ro-bind / /` protects integrity, not confidentiality: the real home directory and
  any on-disk secret store stay **readable** to the workload.
- `env -i`, `HOME=/tmp`, `TMPDIR=/tmp` remove environment *inheritance*, not read
  access.
- `/tmp` is writable inside the sandbox, so `<run>/out` is the only *persistent*
  writable bind, not the only writable path in the unit.
- `--unshare-net` provides an isolated network namespace; it does not by itself prevent
  binding a socket there. "No listener, no port, no request" is a property of this test,
  not of the flag.
- The launcher and the payload's prelude run **outside** bwrap; only the single
  `node --test` process is sandboxed.

**Post-run unit verification and the two gates.** The launcher reads only the payload's
named attestations plus the workload's exit code — it never scans the log for
substrings. `acc_capture_ok=yes` (printed after every applied cap was read back and
matched) and `acc_gate=pass` (printed after the capacity floor held) are the gate; a
missing required attestation is a record fault, while an explicit payload refusal keeps
its own exit code (70) and is reported as `envelope_status=refused_by_payload`. Partial
optional readbacks are recorded, never failed: `acc_metrics_complete=no` (the in-unit
`busctl`/`systemctl` fallbacks and the cgroup knobs frequently come back partly
unavailable on this host) becomes `metrics_status=incomplete_recorded`, and only a failed
write is a `73`.

For the unit itself, `systemctl show -p LoadState -p ActiveState -p MainPID` is run with
its rc recorded. Clean means `not-found`, or `LoadState=loaded` with `ActiveState`
`inactive`/`failed` **and** `MainPID=0`. A unit still in a running state is stopped by its
exact name only, then re-queried and re-classified; still active, unparsed values or a
failed query are record faults, never a pass. `--collect` unloads the unit but does not
erase journald history, so a non-zero `journalctl` rc is always a collection failure (a
message containing "not found" does not excuse it), while rc 0 with an empty capture is
recorded as `empty` with no cause inferred. Defaults read after the fact are **not** the
applied caps, so the in-unit readback is the envelope record.

Every record is written by the launcher directly rather than as the tail of a pipeline,
where the write would happen in a subshell and its fault would be lost; each producer's
failure (text assembly, hashing, `diff` output) is checked separately from the write that
stores it, so no step's outcome is inferred from a later step's success.

**Hashed inputs** (before/after, each file verified individually): `baseline.test.mjs`,
`run.sh`, `payload.sh`, and the eight `src/*.mjs` modules the import chain names
(`src/hub/index.mjs` plus its seven imports at `:5-11`). This is a fixed list restricted
to the package's own `src/`; it is not a transitive closure — deeper imports, Node
builtins and the client build are unhashed — and it does not look at `board/` or
`node_modules/`.

**Evidence produced**: `unit-preflight.txt` (per-family queries with rcs), `argv.txt`,
`hashes-before.txt`, `hashes-after.txt`, `hashes-diff.txt` (only on drift, or with a
`diff_rc` note when the comparison itself failed), `unit.log` (raw TAP),
`systemd-run.rc`, `journal.txt` + `journal.rc` (with a `collected` / `empty` / `failed`
classification), `unit-state-after_workload.txt` /
`unit-state-after_cleanup_stop.txt`, `cleanup-stop.log`/`.out` when a stop was
attempted, and `status.txt` (envelope status, capacity gate, cleanup verdict, metrics
status, every record fault). No file in this slice restates a pass count; the count is
whatever the runner prints.

**Exit codes**: workload code when inputs and records are intact; `70` preflight
refusal, `71` pin mismatch, **`73` record fault (highest priority)** — input hash not
computable, any record not writable (argv, rc, journal, hashes, unit state, status), a
`diff` error (rc > 1, as opposed to rc = 1 for a real difference), a required in-unit
attestation that is missing, a unit not shown inactive, or an unattested envelope with a
zero workload code; `75` lock held, `76` run directory exists, `77` after-hash failed,
`78` inputs drifted. `73` outranks `77`/`78`, which outrank the workload's code; the
workload's code remains in `systemd-run.rc`, and a late status write cannot mask an
earlier fault.

**Boundary as written (before any execution)**: no new extraction, historical run roots
retained read-only, and a single explicit Lead GO was still required. That GO was given
on 2026-11-05 and used exactly once; §10 records it.

## 10. Actual execution record — one run, 2026-11-05

**Authorization.** Lead static review completed, then an explicit single-run GO: one
invocation of the launcher, no prior `node`, no prior `bash -n`, no extra probe, no
install, no build, no network, no change to the pinned original, no Toolkit run. The
test, launcher and payload were frozen at the hashes below before the run. One run only:
no retry, no re-run to obtain a different result.

```
command : bash experiments/third-party-pilots/harbor-baseline/run.sh
started : 2026-11-04T19:08:05Z UTC = 2026-11-05 03:08:05 +08:00
run dir : experiments/third-party-pilots/harbor-baseline/runs/20261104T190805Z-harbor-baseline-413530-5079/
unit    : harbor-baseline-20261104T190805Z-413530.service
pin     : 9465c9fb36d753ae66d45a6617e4d51db8163df9
```

**Three distinct exit codes — they are not interchangeable.**

| code | value | meaning |
|---|---|---|
| `node --test` rc (in unit, `acc_node_rc`) | **0** | the runner reported no failing test |
| `systemd-run` rc (`systemd-run.rc`) | **0** | the unit's own exit status was 0 |
| launcher acceptance rc | **0** | records intact, inputs identical, unit clean, envelope attested |

**TAP counts, as printed by the runner (not by this document).** `tests 8`, `pass 8`,
`fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 285.044841`, test-runner
wall time 599 ms, service runtime 697 ms. The eight names reported `✔`:
`pinned source identity`, `case 1` (reverse-order retraction of all six routes),
`case 2` (throwing synchronous disposer leaves its route mounted, other five retracted),
`case 3` (cleanup does not await an asynchronous disposer), `case 4` (repeated cleanup
re-invokes nothing, returns `undefined`), `case 5` (one failed registration still mounts
five, `/ping` 503), `guards stay closed`, `missing webServer degrades to a no-op
disposer`.

**Envelope, from the in-unit readback** (`unit.log`; post-run `systemctl` defaults are
not the applied caps): cgroup `memory.max=805306368`, `memory.swap.max=0`,
`pids.max=32`, `cpu.max=50000 100000`; unit `Type=exec`, `MemoryMax=805306368`,
`MemorySwapMax=0`, `TasksMax=32`, `RuntimeMaxUSec` resolved to `120000000`
(`acc_unit_runtime_max=2min`). `acc_capture_ok=yes`, `acc_gate=pass`
(`MemAvailable=1754992 KiB >= 1228800 KiB`). Note `acc_runtime_usec_numeric=<unavailable>`
— `busctl` returned nothing on this host and the value came from the `systemctl`
readback; that fallback is recorded as a field, not treated as a failure.

**In-unit accounting**: `memory.peak=65757184`, `memory.current=35811328`,
`pids.peak=16`, `memory.events.local` all zero (`low/high/max/oom/oom_kill/oom_group_kill 0`),
`acc_metrics_complete=yes`.

**Provenance and cleanup**: `hashes-before.txt` and `hashes-after.txt` are byte-identical
(`diff -q` clean, no `hashes-diff.txt`), covering `baseline.test.mjs` `ee8ceff3…`,
`run.sh` `311c18f7…`, `payload.sh` `be925593…`, and the eight `src/*.mjs` inputs
`415adf3b…` (hub/index), `c12cb344…` (freshness), `1ac2b3d1…` (preflight-job),
`a74b9d76…` (scan/index), `65f617eb…` (scan/runtime), `ccb9a627…` (scan/discover),
`900ac193…` (preflight/index), `6d7962ca…` (preflight/host). Pre-launch unit-table query
covered all six families with `query_rc=0` and found nothing active. Exactly one unit-state
query was made — `unit-state-after_workload.txt`, `query_rc=0`, `LoadState=not-found`,
`MainPID=0`; no stop was executed (`cleanup_stop=not_attempted`), so there is no second
query and no `unit-state-after_cleanup_stop.txt`. `status.txt`'s `unit_state_first` and
`unit_state_final` are the same single observation, classified `cleanup_verdict=clean`.
`journalctl` rc 0, `journal_status=collected`
(three journald lines, no per-unit TAP). `record_failures=none`.

**What this run does and does not show.**

- It shows the pinned original's behaviour when driven by the fake host: synchronous
  disposer errors are swallowed and that route stays mounted (case 2), asynchronous
  disposers are not awaited (case 3), repeated cleanup returns `undefined`, and a single
  registration failure still leaves 5/6 mounted with `/ping` 503.
- The fake host keeps routes in a plain `Map`. **No listener, socket or port exists**,
  so a "route left mounted" here is a map entry, **not** a real web-route leak in a host.
- Nothing here is Loader evidence: no real Cordis Loader ran, `/preflight` POST was never
  issued (`preflightJobs.start` is a tripwire), and no adapted kit slice exists yet, so
  there is no before/after delta to report.
- Dependency injection is a behavioural boundary, not a security sandbox, and
  `--ro-bind / /` protects integrity, not confidentiality: a real home directory and any
  on-disk secret store remain readable to the workload. `env -i` removes inheritance,
  not read access.
- The hashed set is a fixed list of eight `src` files, **not** a transitive closure;
  deeper imports, Node builtins and the client build are unhashed.
