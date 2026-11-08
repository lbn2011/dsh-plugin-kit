# Managed Loader acceptance — explicit-Bash invocation under a 768 MiB cgroup (2026-11-02)

**Status: NOT ACCEPTED — the launcher ran, the confined payload ran, and both arms reported `status: "failed"`. No success claim of any kind is made here.**

Mandatory record of the single authorized attempt `20261101T171007Z`, written because executor `a412` finished the internal analysis and did **not** produce the required record. Everything below is transcribed from the raw files indexed in §10; nothing was re-executed (no launcher, unit, test or `node` process), and every number appears in a file.

Distinct from `2026-11-01-managed-loader-acceptance.md` (refused, exit `3`), `2026-11-02-managed-loader-acceptance.md` (scaffold refusal, exit `5`) and `2026-11-02-managed-loader-768-acceptance.md` (invocation `EACCES`, exit `126`).

## 1. What was authorized

| field | value |
| --- | --- |
| subject | `experiments/dsh-live-lab/managed-cleanup/run-isolated.sh` (mode `600`) → `payload.sh` → `bwrap` → confined `node` |
| form | one transient unit, `systemd-run --quiet --wait --pipe --collect` |
| attempts | **one** — no polling, no retry, no `--force`, no rerun |
| unit | `managed-cleanup-20261101T171007Z` |
| runtime root | `.../managed-cleanup/work/run-20261101T171007Z` (`root_exists_now=no` before launch) |
| evidence dir | `reports/2026-11-02-managed-loader-bash-20261101T171007Z/` |
| launcher exit | **`5`** — payload failure, not a refusal and not a pass |

One deliberate difference from the `126` attempt: the wrapper runs `/usr/bin/bash "${MC_LAUNCHER}"`, because the file is mode `0600` and a direct `execve` is `EACCES`. The wrapper runs the launcher once, reads this unit's cgroup once after it returns (the unit is `--collect`ed, so the cgroup dies at unit end), and exits with the launcher's status unchanged.

## 2. Exact invocation (`02-invocation.txt`)

```
systemd-run --quiet --wait --pipe --collect \
  --unit managed-cleanup-20261101T171007Z \
  --property=Type=exec \
  --property=MemoryMax=768M \
  --property=MemorySwapMax=0 \
  --property=TasksMax=32 \
  --property=RuntimeMaxSec=120 \
  --setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --setenv=DSH_MANAGED_CLEANUP_ROOT=<root> \
  --setenv=DSH_MANAGED_CLEANUP_ALLOW_ROOT=<slice> \
  --setenv=DSH_MANAGED_CLEANUP_UNIT=managed-cleanup-20261101T171007Z \
  --setenv=NODE_BIN=/www/server/nodejs/v24.21.0/bin/node \
  --setenv=MC_ROOT=<root> \
  --setenv=MC_REPORT=<report dir> \
  --setenv=MC_UNIT=managed-cleanup-20261101T171007Z \
  --setenv=MC_LAUNCHER=<slice>/run-isolated.sh \
  -- /usr/bin/bash <report dir>/unit-wrapper.sh
```

`<slice>` = `/root/dsh-ecosystem-spec/experiments/dsh-live-lab/managed-cleanup`, `<root>` = `<slice>/work/run-20261101T171007Z`, `<report dir>` = `/root/dsh-ecosystem-spec/reports/2026-11-02-managed-loader-bash-20261101T171007Z`. CPU deliberately unbounded: no `CPUQuota`, no `CPUWeight`, no `AllowedCPUs`.

## 3. Result

| item | value | source |
| --- | --- | --- |
| `systemd-run` returned | **`5`** | `04`; `05` (`systemd_run_rc=5`) |
| wrapper's recorded launcher status | **`5`**, unchanged | `06` (`launcher_exit_code=5`) |
| journal | `Main process exited, code=exited, status=5/NOTINSTALLED`; `Failed with result 'exit-code'` | `05` |
| payload | `payloadRc:1`, `recordProblem: PAYLOAD_RC_NONZERO`, `recordLines: 0` | `03` tail |
| unit after `--collect` | `Result=success`, `LoadState=not-found`, `ActiveState=inactive` | `05` |
| wall clock | `01:10:41` → `01:11:25` (≈ 44 s) | `05`, `06` |
| CPU | `3.779 s` (journal) / `cpu.stat usage_usec 3766156` | `05`, `06` |
| memory | peak `187764736` B (≈ **179 MiB**) of `memory.max=805306368`; `memory.current=44593152` B at capture (after the fact, not a peak) | `06` |
| pids | `pids.peak=17` of `pids.max=32`; `pids.current=2` | `06` |
| swap / OOM / throttle | `memory.swap.current=0`, `memory.swap.peak=0`; `memory.events=low 0 high 0 max 0 oom 0 oom_kill 0 oom_group_kill 0`; `nr_throttled 0` | `06` |
| preflight self-report | `memAvailableMiB=1795` (gate `1200`), `memoryMaxBytes=805306368`, `nodeHeapMiB=384`, `writableMounts=1` | `03` line 1 |
| V8 self-report | `heapSizeLimitMiB=576` (`totalOverOldSpace 1.5`) — total V8 limit, not RSS, not the cgroup ceiling | `03` |

`status=5/NOTINSTALLED` is systemd's name for generic exit code 5, not a statement that something is or is not installed; `Result=success` is the post-`--collect` record of a unit that exited 5. Neither number is a pass.

## 4. Effective caps: issued vs observed

Read inside the unit from `/sys/fs/cgroup/system.slice/managed-cleanup-20261101T171007Z.service` and `systemctl show`, after the launcher exited (`06`):

| limit | issued | observed | verdict |
| --- | --- | --- | --- |
| `Type` | `exec` | `Type=exec` | ✅ |
| `RuntimeMaxSec=120` | 120 s | `RuntimeMaxUSec=2min` (never fired) | ✅ |
| `MemoryMax=768M` | ≤ 805306368 | `memory.max=805306368`, `memory.high=max` | ✅ |
| `MemorySwapMax=0` | exactly 0 | `memory.swap.max=0`, `memory.swap.current=0` | ✅ |
| `TasksMax=32` | ≤ 32 | `pids.max=32`, `pids.peak=17` | ✅ |
| CPU | unbounded by choice | `cpu.max=max 100000`, `CPUQuotaPerSecUSec=infinity`, `CPUWeight=[not set]`, `AllowedCPUs=` | ✅ |
| `memory.events` | — | `max 0`, `oom 0`, `oom_kill 0` — the cap was never reached | ✅ |

The caps are not implicated in the failure, and **no evidence exists of any process running outside the envelope** (peak 179 MiB of 768, peak 17 pids of 32, zero swap). Any claim that `node` escaped the caps would be invented and is not made.

## 5. What each stage did

| stage | state | evidence |
| --- | --- | --- |
| memory gate → `bwrap` → confined payload | **ran** (`environment` steps `rc:0`) | `03` |
| `prepare.mjs` | **ran, `rc:0`** — 7-file scaffold, 3 links, fault fixture written | `03` |
| `arm-generated.mjs` | **ran, `rc:1`**, `status:"failed"` | `03`; `records/generated.json` |
| `arm-fault.mjs` | **ran, `rc:1`**, `status:"failed"` | `03`; `records/fault.json` |
| `validate-records.mjs` | **ran, `rc:1`** — `ARM_NOT_OK:generated`, `ARM_NOT_OK:fault` | `03`; `records/run.json` |
| read-only mount probe | **refused, `EROFS`**, as designed | `03` |
| generated files after the arms | **byte-identical** (7 files, digest `3a959862…e86b` before and after) | `03` |

## 6. The two arms, as recorded

**generated** — 23 assertions, 12 ok, 11 failed: `row-active-after-boot`, `tool-present-after-boot`, `live-definition-is-the-generated-tool`, `tool-output-native-executor`, `native-outcome-explicit`, `row-active-after-reenable`, `tool-present-after-reenable`, `reenable-is-a-new-registration`, `reenable-installed-a-different-definition-object`, `tool-output-after-reenable`, `native-outcome-explicit-after-reenable`. The row never activated — the wait expired (`waitedMs: 20003`; `20006` on re-enable) — the tool was never registered (`Error: unknown tool "managed_cleanup_hello"`), and the activation error as printed was:

```
ManagedRegistrationAsyncPortError: managed registration "managed-cleanup-generated":
port "register" returned function; activation in this module is synchronous, so a port
must return its disposer function and not a promise
    at registerManagedResource (projects/dsh-plugin-kit/src/managed-registration.js:421:15)
    at new apply (…/generated/managed-cleanup-generated/index.js:58:18)
```

**fault** (synthetic fixture, *not* the generated artifact) — 53 assertions, 36 ok, 17 failed: `close-called-once-by-fiber-cleanup`, `close-rejection-handler-installed-in-same-tick`, `close-promise-rejected`, `close-promise-await-independently-rejects`, `close-rejection-is-scope-failed`, `close-rejection-is-aggregate`, `original-fault-preserved-by-identity`, `close-message-counts-failures`, `callback-unsubscribe-disposer-ran-once`, `callback-close-rejection-observed-once`, `counted-unregister-callback-ran-once`, `fixture-counter-agrees-with-trace`, `counted-callback-invoked-the-exact-native-disposer`, `counted-callback-ran-after-the-throwing-unsubscribe`, `stale-close-returns-the-same-promise`, `stale-close-rejection-identity-preserved`, `generation-2-cleanup-ran-exactly-once-on-host-teardown`. The observed trace stops at `port:register`, `port:register:done`, `port:subscribe`, `apply:returned`; `close` was called **0** times (`attempts: 0`, `callSites: []`), so the counted unregister callback never ran (`count: 0`, fixture counter `0`).

**run** — 10 assertions, 6 ok, 4 failed (`generated-arm-succeeded`, `fault-arm-succeeded`, `both-arms-passed`, `run-succeeded`). The six passing ones are provenance/validity checks; agreement between a record and its exit code is explicitly diagnostic only, not success.

## 7. Source hashes — zero source mutation

`01-source-hashes-before.txt` and `09-source-hashes-after.txt` each hold **35 hashed entries** across 37 non-comment lines (20 slice sources, 3 preserved prior-run artifacts, 12 files of the `126` attempt's report dir; the other 2 lines are blank separators). Comparing them line by line and ignoring comment lines: **all 35 hashes are identical.** The only content in `09-source-hashes-diff.txt` is four comment lines, whose wording and generation timestamp differ because different steps wrote them:

```
-# sha256 of every source file in the slice — BEFORE the launch
-# generated 2026-11-02T01:10:35+08:00
-# preserved prior-run artifacts (must stay byte-identical)
-# the previously failed attempt's report dir (must stay byte-identical)
+# sha256 — AFTER the launch
+# generated 2026-11-02T01:11:39+08:00
+# preserved prior-run artifacts
+# previous failed attempt report dir
```

The diff is therefore **not** a change signal, and it was not read as one: no source file, no preserved prior-run artifact and no file of the `126` report directory changed, so the historical `126` record stands byte-for-byte as it was.

## 8. Artifacts and host state (`07`, `05`)

Present: `logs/launched.once` (0 B, `e3b0c442…b855`), `logs/payload.log` (27613 B, `f910face…e329`), `records/run.json` (2635 B), `records/generated.json` (4853 B), `records/fault.json` (8779 B), `prepare.json` (4426 B). Absent as named: `records/prepare.json`. The scaffold, its three `node_modules` links and the fault fixture (`counted-disposer.mjs`, `managed-fault.plugin.mjs`, `trace.mjs`) are on disk with sizes recorded; the scaffold's own `test/plugin.test.js` was **not executed**.

Afterwards the unit is `LoadState=not-found`, `ActiveState=inactive` and the `managed-cleanup` listing is empty — **no unit remains**. The only failed unit on the host is the pre-existing, unrelated `rc-local.service`. Existing work roots and the historical slice logs were untouched.

## 9. Known gaps — what this record does not establish

- **Nothing about a pass.** Both arms failed, the payload exited 1, the launcher exited 5. There is no partial credit and none is claimed.
- **No claim that the scope drain is broken.** The failures were measured in this run, *before* a later manual stale-close was taken; `close` count 0 and the missing initial promise (`stale-close-returns-the-same-promise: samePromise: false`) are observations at that instant only, and a missing initial promise **cannot** diagnose memoization. Root cause is under a separate read-only review and is not concluded here.
- **No Loader/kit verdict.** One boot per arm, one profile, one machine. The two 20 s wait expiries (≈ 40 s of the ≈ 44 s wall) belong to the arm harness, not to a measured teardown deadline; no latency bound exists in this slice.
- **Bounded memory observation, not a full profile.** The cgroup peak of 187,764,736 bytes (about 179 MiB) is an actual measurement of this unit. The 768 MiB ceiling is a separate enforced limit; neither establishes a general workload memory bound.
- **No invented deviations.** No evidence shows any process outside the caps, and this record adds none.
- **Budget and chronology:** this run reports a `1200 MiB` gate, `--max-old-space-size=384`, and a measured V8 total heap limit of `603979776` bytes (`576 MiB`). The earlier ≈432 MiB estimate was not an observation or an equality requirement. The exit-126 attempt at `01:06:45+08:00` never ran the launcher or heap probe; it also requested a 768 MiB cgroup. The `00:39` preparation failure belongs to a different, earlier 1536 MiB attempt. The subsequent budget and preparation edits were intentional and documented; file mtimes alone do not identify which attempt used which content.
- **Incomplete inventory:** the report dir has no `08-index.md`, so the file-index step of the standard slice was not produced. This document does not invent one.

## 10. Evidence index

Report dir `reports/2026-11-02-managed-loader-bash-20261101T171007Z/`:

| file | what it holds |
| --- | --- |
| `00-pre-attempt-snapshot.txt`, `02-invocation.txt` | pre-state and modes (`root_exists_now=no`); the exact command of §2 |
| `01-source-hashes-before.txt`, `09-source-hashes-after.txt`, `09-source-hashes-diff.txt` | 35 hashes each, identical; the four comment-line differences quoted in §7 |
| `03-launch-output.txt` | launcher preflight, every payload step, both arm records, validator output |
| `04-launcher-exit-code.txt`, `05-unit-state-after.txt` | `5`; `systemd_run_rc=5`, collected unit, journal, host state |
| `06-in-unit-capture.txt`, `07-artifacts.txt` | in-unit cgroup and effective-limit read before collection; present vs absent artifacts, scaffold tree, links |
| `unit-wrapper.sh` | the minimal in-unit wrapper (no polling, no retry) |

Runtime records under `experiments/dsh-live-lab/managed-cleanup/work/run-20261101T171007Z/records/`: `run.json` (`failed`, 10 assertions / 6 ok), `generated.json` (`failed`, 23 / 12 ok), `fault.json` (`failed`, 53 / 36 ok).
