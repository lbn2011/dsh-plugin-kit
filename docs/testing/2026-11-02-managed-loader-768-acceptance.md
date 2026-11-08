# Managed Loader under a 768 MiB cgroup — 2026-11-02 acceptance

**Status: NOT ACCEPTED — the launcher never executed. There is no real-host Loader
evidence in this record, and none is claimed.**

This file is the mandatory deliverable of the authorized single attempt. It records
what was run, what the kernel and systemd reported, what failed, and why the failure
is an invocation defect rather than a Loader result. It deliberately contains no
success claim of any kind.

---

## 1. What was authorized

One — and only one — attempt of
`experiments/dsh-live-lab/managed-cleanup/run-isolated.sh`, in a **new unique runtime
root** under its `work/`, with the system-level limits
`Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`, `RuntimeMaxSec=120`,
CPU **unbounded by explicit choice** for this real-host stage, and
`--max-old-space-size=384` passed by the launcher itself.

Prior context supplied with the authorization (not measured here): the regression
directory was accepted 51/51 and the budget edits were finished. That context is
recorded as given, not as evidence produced by this attempt.

## 2. Exact invocation

```
systemd-run --quiet --wait --pipe --collect \
  --unit managed-cleanup-20261101T170604Z \
  --property=Type=exec \
  --property=MemoryMax=768M \
  --property=MemorySwapMax=0 \
  --property=TasksMax=32 \
  --property=RuntimeMaxSec=120 \
  --setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --setenv=DSH_MANAGED_CLEANUP_ROOT=<slice>/work/run-20261101T170604Z \
  --setenv=DSH_MANAGED_CLEANUP_ALLOW_ROOT=<slice> \
  --setenv=DSH_MANAGED_CLEANUP_UNIT=managed-cleanup-20261101T170604Z \
  --setenv=NODE_BIN=/www/server/nodejs/v24.21.0/bin/node \
  --setenv=MC_ROOT=<root> --setenv=MC_REPORT=<report dir> \
  --setenv=MC_UNIT=managed-cleanup-20261101T170604Z \
  --setenv=MC_LAUNCHER=<slice>/run-isolated.sh \
  -- /usr/bin/bash <report dir>/unit-wrapper.sh
```

where `<slice>` is
`/root/dsh-ecosystem-spec/experiments/dsh-live-lab/managed-cleanup`, `<root>` is
`<slice>/work/run-20261101T170604Z` (fresh, did not exist before the attempt), and
`<report dir>` is
`/root/dsh-ecosystem-spec/reports/2026-11-02-managed-loader-768-20261101T170604Z`.

The unit ran a **minimal in-unit wrapper** whose only jobs were: run the launcher
once, then read the unit's own cgroup once after the launcher exited (the unit is
created with `--collect`, so the cgroup disappears at unit end), then exit with the
launcher's status unchanged. The wrapper does **not** poll, sample, retry, or wait.

## 3. Result

| Item | Value |
| --- | --- |
| `systemd-run` returned | **126** |
| wrapper's recorded launcher status | **126** |
| bytes on stdout/stderr | `unit-wrapper.sh: line 47: .../run-isolated.sh: Permission denied` |
| runtime root | **never created** |
| `<root>/logs/payload.log` | absent |
| `<root>/logs/launched.once` | absent — no launch marker was ever claimed |
| `<root>/records/run.json` | absent |
| launcher lines executed | **zero** |
| prepare / arm-generated / arm-fault / validate | **never started** |
| memory gate | **never evaluated** — the launcher never ran |
| heap self-report (`heap_size_limit`, ~432 MiB expected) | **never produced** |
| workload cgroup peak | **none exists** (see §6) |

## 4. Cause

`run-isolated.sh` (and `payload.sh`) are mode `0600` in this slice — no execute bit.
The wrapper invoked the launcher as a command (`"${MC_LAUNCHER}"`), which is
`execve` on a non-executable file: `EACCES`, surfaced by bash as
`Permission denied` and exit code `126`.

The failure is an **invocation-form defect on my side**, and it is reproducible from
the documentation alone: `systemd/transient-launch.md:35` shows the launcher as
`"$PWD/run-isolated.sh"`, which would fail identically. The earlier attempt at
`2026-11-02T00:39` used `-- /usr/bin/bash .../run-isolated.sh` and therefore reached
the payload (`reports/2026-11-02-managed-loader-acceptance/27-invocation.txt`). The
working form is the explicit-interpreter form.

Nothing here says anything about the Loader, the kit, or the 768 MiB budget: the
confined tree was never entered, and `bwrap` was never started.

## 5. Limits — effective, read back while the unit was alive

Read from systemd and from the kernel **inside** the unit, after the launcher exited
and before collection (`06-in-unit-capture.txt`):

| Limit | Effective value | Required | Verdict |
| --- | --- | --- | --- |
| Type | `exec` | `exec` | ✅ |
| RuntimeMaxUSec | `2min` (120 s) | > 0 and ≤ 120 s | ✅ |
| MemoryMax / `memory.max` | `805306368` | ≤ 805306368 (768 MiB) | ✅ |
| MemorySwapMax / `memory.swap.max` | `0` | exactly 0 | ✅ |
| TasksMax / `pids.max` | `32` | ≤ 32 | ✅ |
| `CPUQuotaPerSecUSec` | `infinity` | unbounded (selected) | ✅ |
| `CPUWeight` | `[not set]` | unbounded | ✅ |
| `AllowedCPUs` | empty | unbounded | ✅ |
| `cpu.max` | `max 100000` | unbounded | ✅ |

The limits were applied correctly. They were simply never reached by a workload,
because no workload started.

## 6. Resources

From `06-in-unit-capture.txt`, for **this unit**:

- `memory.peak` = `2215936` B (≈ **2.11 MiB**)
- `memory.current` = `2183168` B at capture
- `memory.events` / `memory.events.local` = `low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0`
- `memory.swap.current` = `0`, `memory.swap.peak` = `0`
- `pids.current` = `2`, `pids.peak` = `2`
- `cpu.stat` usage ≈ `31.9 ms`

**This peak is the footprint of a bash wrapper, a failed `execve` and one
`systemctl show` call. It is not a workload measurement and must not be quoted as
one.** No workload memory figure exists, because the workload never started.

Capacity: a read-only `MemAvailable` read at `2026-11-02T01:06:27+08:00` returned
`1865160 kB` (≈ 1780 MiB). That read is a pre-flight sanity check only — the
authoritative 1200 MiB gate belongs to the launcher, and the launcher never evaluated
it.

## 7. Source hashes (before → after: identical)

Recorded in `01-source-hashes-before.txt` and `09-source-hashes-after.txt`; the diff
is empty (`09-source-hashes-diff.txt`). Nothing in the slice was edited, and no test
or runtime file was modified.

| File | sha256 |
| --- | --- |
| `run-isolated.sh` | `1080041cd684b163793b2789894cafd896bb395bae40134ef0af6ab7534c29e9` |
| `payload.sh` | `fd36db63756155e1655b68079649617522f756c77f5a1d1c2dac2632b6f0da10` |
| `prepare.mjs` | `0ea34611496b6d7796478600a834296d351269c7a60ce04458944375709080f9` |
| `arm-generated.mjs` | `9f5eab73ccf5bac65e98917a9be1241be5afca5155da6ebe95870d944b9aca39` |
| `arm-fault.mjs` | `6dde1460506be2b96b481e48b4ba9773b5383fba43fa49819b2afd0d43f44f1f` |
| `validate-records.mjs` | `9fd2c55a841de060e8327760fbb006c862f0af99a12d4851fb32408b239eb84f` |
| `lib/host.mjs` | `ed5c23f94d95240383a1510b476fda911fb1c47b1431c598ff4bf0605e696f43` |
| `lib/layout.mjs` | `92545b22c40b087e17492e7adaabe4d871065aa4496f05259187eedfac7a53f7` |
| `lib/record.mjs` | `31e41c67c97eb05f4d73600e5d025358311acea027fa7db04712b207f4ab4960` |
| `tests/counted-disposer.test.mjs` | `3d797493fc732613c11762704c3e867913908b998c929d1ff1913935b0df1c57` |
| `tests/prepare-generated-parent.test.mjs` | `cbc5414b49a75fc4fe45ee6c16d24277aa97bb4a3308ab313e112685087c6879` |
| `tests/read-only-boundary.test.mjs` | `f0447bc4afc285dd788137bcf394b78b11b5ee560ff20567e3edcd414f9b6b5d` |
| `tests/validate-records.test.mjs` | `61175f7cfc5863f16a266d48a1606e03caa8b661d54c52dbfcd1c04d4a4acfc7` |
| `fixtures/counted-disposer.mjs` | `2fbf2db04eb8f8bca90961eb45494112bc717179fec12ed6cd8c24c1824283a3` |
| `fixtures/managed-fault.plugin.mjs` | `fdb6394fdd528515e2da0756794e56a3bf1b6434f35ec8dab8489a9b60a5aeb8` |

## 8. Preserved, untouched

- `work/run-20261101T163853Z/` (the 00:39 attempt: its `records/run.json` hash
  `4e825a9a2c5415bbeec2d37601e0f57cbd4dd4e47472df1a74ed9f0bd8be0e8d`)
- `logs/payload.log` (`db311f39ee5ac875810c052500a38433ca41092b1949b2fa1a36bfc45e7245f8`)
  and `logs/launched.once` (`e3b0c442…`, empty) — historical, still unread by the
  launcher
- every earlier report directory

No delete, no move, no rewrite, no build, no install, no production `:3080` action,
no write to `/root/.dsh`.

## 9. Process deviations

1. **The decisive one.** The wrapper `exec`d `run-isolated.sh` directly instead of
   `/usr/bin/bash run-isolated.sh`. Result: `EACCES`, rc 126, launcher never ran.
2. Pre-flight ran `/www/server/nodejs/v24.21.0/bin/node --version` **outside** the
   bounded unit (version string only; no workload, no repo write).
3. A pre-flight `systemctl show` for unit-name collision returned `Id=…`, which
   `systemctl` synthesises for a unit that does not exist. It is not evidence of
   existence; `list-units` was empty. Post-collection `systemctl show` likewise
   returns synthetic defaults (`Result=success`, `ActiveState=inactive`) and is not
   evidence either way. The real outcome evidence is the wrapper's in-unit capture
   plus `systemd-run`'s returned status.
4. **No rerun was performed**, including after the launch failure, per the
   one-attempt rule. No wrapper polls memory; no limit was raised; no job was left
   running.

## 10. What this record does NOT establish

- No real-host Loader acceptance. No claim that managed cleanup works or fails.
- No `prepare.mjs` outcome, no generated-arm outcome, no fault-arm outcome, no arm
  assertion counts or skips, no tool-vs-native-callback causal evidence, no natural
  exit of the confined tree — none of it exists, because the launcher never started.
- No V8 `heap_size_limit` observation (the expected 432 984 832 B was never read).
- No workload memory peak, no `memory.events` pressure, no OOM verdict for a
  workload.

## 11. What would close it (next authorized attempt)

1. Invoke the launcher through an interpreter — `/usr/bin/bash <abs>/run-isolated.sh`
   — or make the file executable first; the documentation at
   `systemd/transient-launch.md:35` should be corrected to match, since the direct
   form cannot work at mode `0600`.
2. Keep `Type=exec`, `MemoryMax=768M`, `MemorySwapMax=0`, `TasksMax=32`,
   `RuntimeMaxSec=120`, CPU unbounded, and the launcher's literal
   `--max-old-space-size=384`.
3. Use a **new** unit name and a **new** root. Root `run-20261101T170604Z` never
   existed and carries no marker, so nothing is spent — but a new name keeps the
   one-launch-per-root invariant legible.

## 12. Raw evidence

Report directory: [`reports/2026-11-02-managed-loader-768-20261101T170604Z/`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/)

| File | Contents |
| --- | --- |
| [`00-pre-attempt-snapshot.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/00-pre-attempt-snapshot.txt) | pre-state, preserved-artifact hashes, capacity sanity read |
| [`01-source-hashes-before.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/01-source-hashes-before.txt) | hashes before |
| [`02-invocation.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/02-invocation.txt) | the exact command |
| [`03-launch-output.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/03-launch-output.txt) | the only line the unit produced: `Permission denied` |
| [`04-launcher-exit-code.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/04-launcher-exit-code.txt) | `126` |
| [`05-unit-state-after.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/05-unit-state-after.txt) | post-state: root absent, unit collected, modes |
| [`06-in-unit-capture.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/06-in-unit-capture.txt) | in-unit cgroup + effective-limit read, before collection |
| [`07-artifacts.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/07-artifacts.txt) | present vs absent artifacts |
| [`09-source-hashes-after.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/09-source-hashes-after.txt) / [`09-source-hashes-diff.txt`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/09-source-hashes-diff.txt) | hashes after, empty diff |
| [`unit-wrapper.sh`](../../../../reports/2026-11-02-managed-loader-768-20261101T170604Z/unit-wrapper.sh) | the minimal in-unit wrapper (no polling) |

No commits, no push.
