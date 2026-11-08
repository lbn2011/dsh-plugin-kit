# Historical test records — dsh-plugin-kit (backfilled)

Date of backfill: 2026-11-01 (Asia/Shanghai). Status: documentation only.

This file backfills this project's execution evidence in two layers. §1–§6 are the
original first-slice backfill, preserved as written except where a statement is marked
*corrected*; they describe a code snapshot that existed on 2026-10-31. **§7–§9 were
appended on 2026-11-01** to record the later real-host stages that the first-slice text
neither covered nor knew about — the kit-generated plugin lifecycle inside the official
built Loader, the official CLI's readiness launch, and the boundary of the guard rounds.
Both layers record the past only: **no run was repeated for this documentation
backfill**; every number below is transcribed from a retained report, not reproduced.
Nothing here is a current guarantee about the present tree. This file does **not**
replace [2026-11-01-cleanup-acceptance.md](2026-11-01-cleanup-acceptance.md), which
governs a different, later slice and remains the authoritative — currently `NOT RUN` —
record for the cleanup and managed-registration modules.

## 1. How to read this record

- Evidence tier for **§2 rows 1–2 only**: **unit + generated-project-under-doubles**,
  plus one caller-owned cross-repository integration test. *(Corrected 2026-11-01: the
  original wording said "No real DSH host, Loader, profile or browser was ever executed
  for this package." That was true of the first-slice rows and false for the package's
  later history, which the original backfill did not know about.)* Later stages on
  2026-11-01 **did** execute a real DSH host, the official built Loader, a real profile
  and the official CLI launcher against kit-generated output — see §7 and §8. A
  browser/GUI was still never executed and no Web surface was exercised in any stage;
  §8 explains why 13/13 there is CLI service readiness and not browser health.
- The first-slice runs were performed by the Lead as independent acceptance after a
  correction handoff, and are summarized in the parent workspace planning document
  [2026-10-31-first-slice-dev-plan.md](../../../../docs/requirements-and-design/2026-10-31-first-slice-dev-plan.md)
  §7. That document is **outside this repository**; it is an external reference, not a
  portable artifact. The facts below are restated so this record stands alone.
- Original run logs and TAP output were **not retained** in this repository.

## 2. Evidence ledger

| # | What ran | Result | Tests | Exit | Limits observed | Evidence tier |
|---|---|---|---|---|---|---|
| 1 | `node --test "tests/*.test.js"` (documented suite command) | PASS | 54 tests / 54 pass / 0 fail | not recorded | not recorded | unit + doubles |
| 2 | Three-repository integration, caller-owned test | PASS | 7 tests / 7 pass | not recorded | not recorded | cross-repo, unit-level |
| 3 | Cleanup / managed-registration slice | **NOT RUN** | none executed | not observed | planned only | — |

Row 2 is a **cross-repository** record, not a kit-only one: the same 7-test run covered
the actual protocol package, this kit and the analyzer together, and the final
post-handoff rerun also passed 7/7. The test itself is caller-owned and lives in the
parent workspace; no production package here depends on that parent workspace. Here it
is reported only as evidence that kit-generated declarations validated through the
actual protocol package.

Row 3 is deliberately **not** green and must not be read as covered by row 1. The
54-test suite predates the cleanup and managed-registration modules; it is not evidence
for them. Their acceptance file is still `NOT RUN` with an empty results ledger.

## 3. Review findings retained (they preceded the green run)

The 54/54 result came *after* a correction handoff. The following were rejected during
lead review of the preview and fixed before the accepted run; they are kept here so the
record does not read as if the first version passed:

1. `src/protocol.js` duplicated declaration-shape validation and used a closed `SCOPES`
   list; scope labels must be open caller-supplied strings.
2. `ctx.tools` was listed under optional despite `inject: ['tools']`; tools is required.
3. The generated metadata wrongly claimed `~0.2.2` includes `0.2.2-alpha.2`; peers now
   carry the individual pinned source versions (`@deepseek-ai/dsh-tools`
   `0.2.2-alpha.2`, `@deepseek-ai/cordis` `4.0.6-alpha.1`,
   `@deepseek-ai/schemastery` `3.18.6-alpha.1`).
4. `validateWith` accepted `{ valid: true }` with no `issues` array as valid; malformed
   and inconsistent validator results are now rejected, and the CLI verification path
   uses the real injected validator rather than fallback shape checks.
5. The generated test wrongly asserted `Config` is a plain object with
   `Object.prototype`. The pinned official `vendor/schemastery/src/index.ts:254-283`
   creates a **callable function**. Template tests and test doubles were corrected.
6. Leftover debug CLI output was removed.

Also retained as a limitation: partial scaffold writes are explicitly
**non-transactional**, and the generator refuses existing destinations rather than
overwriting user files.

## 4. Provenance gaps (do not invent these)

- **Code revision at run time: NOT RECORDED.** No commit, tag or digest accompanied
  rows 1–2. This project's own repository has an initialized but commit-less git history
  (`git rev-parse --verify HEAD` → "Needed a single revision") and the parent workspace
  tracks no file under `projects/`, so the recorded results cannot be pinned to any
  revision and cannot be attributed to the current tree. **Two limits, so that is not
  over-read:** (a) an unborn HEAD is only the reason *no commit was available at run
  time* — it does not establish that no per-file source digest was ever computed or kept
  somewhere else; a missing recorded revision is a gap in this record, not a finding that
  all source hashes are absent. (b) Hashes of the files that exist today are **not**
  run-time hashes and must never be backfilled into these rows, and a commit that exists
  in some enclosing repository does not retroactively pin a run whose tree state was
  never captured.
- **Exit codes, wall time, memory peak, cgroup caps: NOT RECORDED.** The first-slice
  runs used no bounded envelope; no cap was requested or observed.
- **Timestamp:** only the planning date 2026-10-31 survives; the actual acceptance run
  time was not recorded. Time zone, where any applies, is the workspace convention
  (Asia/Shanghai).

## 5. Links to the original reports

Relative from this file, all referring to the **parent workspace** outside this
repository — traceability only, not portable with this package.

- [First-slice development and acceptance plan](../../../../docs/requirements-and-design/2026-10-31-first-slice-dev-plan.md) — §7 is the only surviving summary of rows 1–2; §5 lists findings 1–6 above.
- [This project's requirements](../requirements-and-design/2026-10-31-plugin-kit-requirements.md) — the 54-test suite, the zero-dependency CLI and the "no host evidence" limits.
- [Cleanup and managed-registration acceptance record](2026-11-01-cleanup-acceptance.md) — row 3; still `NOT RUN`, untouched by this backfill.
- [README.md](../../README.md) — documented commands and the stubbed-peer limitation.

## 6. Checklist for future test records (mandatory)

Any subagent that executes tests for this repository must write its outcome into a new
dated file under `docs/testing/` and satisfy every item below. The Lead reviews it
before the result is cited.

1. **Outcome first.** One of `PASS`, `FAIL`, `REFUSED`, `NOTRUN`, stated before any
   narrative. Written-but-unexecuted cases are `NOTRUN`, never pass.
2. **Never replace red with green.** Append attempts; do not edit an older attempt's
   row. A later pass never erases an earlier failure or refusal.
3. **Timestamps with time zone.** Start and end, ISO 8601 with offset
   (e.g. `2026-11-01T21:40:12+08:00`), plus unit/job name if any.
4. **Exact commands, verbatim**, including the explicit test-file list and any env vars
   (e.g. `DSH_COMPAT_SPEC=<path>` for the opt-in integration run). If unknown from
   evidence, write "not retained" — never reconstruct.
5. **Caps requested vs observed.** Memory max, swap, task max, CPU quota, wall limit,
   Node heap cap — observed read from the unit/cgroup, not assumed. Say "no envelope"
   when none was used.
6. **Code revision at run time.** Commit + dirty state, or per-file sha256 when there is
   no commit. If not captured, say so — the record is unpinnable.
7. **Counts and exit codes.** Total, pass, fail, skipped, cancelled and the real exit
   code. Keep generated-project runs against **doubles** labelled as such, never as
   real-dependency execution.
8. **Raw logs retained, by path.** Otherwise mark the row "summary only, raw not retained".
9. **Scope and evidence tier.** Unit/double/static versus real Loader, profile, host or
   browser — and the claims that therefore do not follow.
10. **Deviations disclosed.** Anything outside instructions: retries, extra probes, budget
    changes, memory-gate result and literal refusal codes.
11. **Refusals separate from failures.** A generator refusal or preflight gate is
    `REFUSED` with its code and text, not a failure and not a pass.
12. **No cross-attribution.** The 54-test suite never certifies the cleanup or
    managed-registration modules, and no old result certifies newer code.

## 7. Later stage A — kit-generated plugin lifecycle in the official built Loader

Appended 2026-11-01. Both runs below used **real kit output**, not a handwritten fixture;
both live in the parent workspace, so they are traceability references, not portable
artifacts of this package.

### 7.1 First run — FAILED at step 4 of 6

Report: [host-smoke-generated-kit-lifecycle.md](../../../../experiments/low-memory-build/reports/host-smoke-generated-kit-lifecycle.md),
nonce `20261101t1622z-a7f3`, generated tree `generated-kit-20261101t1622z-a7f3`.

| Fact | Value |
|---|---|
| lifecycle unit | `hostsmoke-genlife-20261101t1622z-a7f3`, invocation `29de61d422c5490db9d293eb0359f08f` |
| unit status | `ExecMainStatus 0/SUCCESS` — **the wrapper's** status: the script echoes `LIFECYCLE-RC` and exits 0 |
| lifecycle process | **rc=1**, 3.050 s, CPU 1.919 s, memory peak 176.5 M, swap 0 B |
| preparation units | r1 exit 6 (193 ms, 12.8 M), r2 exit 6 (66 ms, 13.3 M), r3 success (253 ms, 15.2 M) |

Steps 1–3 passed: `driver-armed` (entry `include:generated-kit-plugin`, phase `active`,
`mismatch:false`), `generated-tool-output` (`generated_kit_hello` → `Hello, Ada!` through
the root executor with the generated `Config` default applied), `lookup-present-before`
(`identityStable:true`). Step 4 failed: `test_driver_plugin_set_enabled(enabled:false)` →
`ok:false, code:"POLICY_CONFIG_INVALID"`, message `the loader did not apply the requested
change`. `receiptOf` (`driver-core.js:653-661`) deliberately replaces helper messages, so
only the code survives; the most consistent remaining candidate — an inference, not a
proof — is the entry object replaced across `loader.update(id,{disabled:true})` +
`loader.await()`, refused at `loader-ops.js:456-458`.

What *is* this package's evidence in that run is its preparation phase (r3, green), which
was driven through the kit's own scripts inside the bounded unit:

- `prepare.mjs scaffold` → the real `writeScaffold(options, {dryRun:false})`,
  `targetCreated:true`, 7 files (`package.json`, `cordis.patch.yml`, `index.js`,
  `declaration.json`, `jsconfig.json`, `README.md`, `test/plugin.test.js`),
  `skipped:[]`, `failed:null`.
- `prepare.mjs validate` → the real protocol owner
  `projects/dsh-compat-spec/src/index.js` `validateDeclaration`: `valid:true`,
  `issues:[]`.
- `prepare.mjs links` → both `node_modules/@deepseek-ai/*` symlinks created.

r1 and r2 exited 6 at the **read-only** preflight because the launcher envelope omitted
env vars the kit documents and never defaults (`DSH_HOST_SMOKE_NONCE`, then
`DSH_HOST_SMOKE_KIT_DIRECTORY` / `..._KIT_TARGET_FILE` / `..._KIT_MODULE`). The kit's own
gate refused them correctly and no write occurred — a launcher defect, not a source
defect, recorded rather than dropped.

### 7.2 Second run — PASS, 8 of 9 assertions, 1 deliberate skip

Report: [generated-lifecycle-temporary-profile.md](../../../../experiments/low-memory-build/reports/generated-lifecycle-temporary-profile.md).
Pre-existing script `experiments/dsh-live-lab/host-smoke/generated/run-isolated-lifecycle.sh`,
unmodified, **launched exactly once**; background job `bash-34fb0a22657f4bd2`, exit 0;
wall clock 2026-11-01T17:56–17:57 (+08:00).

| Fact | Value |
|---|---|
| unit | `dsh-genlife-20261101t1622z-a7f3-643362-1793527028914.service`, systemd invocation `6b5fc0daea0142b488ea8f56ad799329` |
| unit result | `success`, `code=exited, status=0/SUCCESS`; launcher `unit_rc=0`, `systemd-run rc=0`, `NODE_RC=0` |
| declared limits | `Type=exec`, `MemoryMax=1536M`, `MemorySwapMax=0`, `TasksMax=32`, `RuntimeMaxSec=120`, CPU unbounded |
| service runtime / CPU | 3.518 s / 2.035 s |
| systemd `Memory peak` | 189.8 M, swap 0 B — no OOM, no throttle |

Assertions from the unit's own JSON envelope (`{"type":"host-smoke/generated-lifecycle","ok":true,…}`):
`driver-armed`, `generated-tool-output`, `lookup-present-before`, `driver-disable`
(`active`→`disposed`), `lookup-absent-after-disable` (`tools.get(name) === undefined`),
`driver-enable` (`disposed`→`active`), `lookup-present-after` (fresh definition object),
`output-restored` — **8 passed**. `dispatch-negative-absent-tool` is **`skipped`
(`ok:null`)**, because the UNKNOWN_TOOL contract was never sourced; absence is asserted
through public lookup instead. So the disable→enable cycle is real (the tool is gone after
disposal, not a stale cache hit, and returns as a new definition), but **missing-tool
dispatch is unproven — a skip is not a pass**.

Originals unchanged: profile digest
`6d61d1788a7ccb56ede0f7deac234d37801e6988c6a309522f5b2f1d4bee4a08` and marker sha256
`1831f1dc1184db9f2aedc9a7dd15973b46653165ec9db5398a863f1960a60146` identical before and
after (`original_profile=MATCH`, `original_marker=MATCH`).

**Caps are requested, not verified — this is the corrected framing.** That run's in-unit
capture failed: all four `cgroup =` lines are empty (`cat: /sys/fs/cgroup/: Is a directory`)
and `invocation_id=<unset>`, so **no cap was read back from inside the unit**. The 189.8 M
figure is systemd's own `Memory peak`, not a cgroup readback, and neither
`RuntimeMaxSec=120` nor `TasksMax=32` was observed in force. Read this row as "limits
requested", never as "limits proven effective"; the effective-config proof that the
launcher recheck obtained (§8) was **not** obtained here.

Second in-unit defect, benign: `dsh: warning: 1 entry did not activate` —
`hmr (@deepseek-ai/dsh-hmr): Error: Profile HMR requires application readiness`. Expected
in a headless unit with no readiness handshake; it affected no assertion, and it is not
launcher-readiness proof either way.

## 8. Later stage B — official CLI readiness: a service contract, never a browser

Appended 2026-11-01. Two runs of the **real** official launcher
(`build-checkout/apps/cli/lib/bin.js`, `bin.dsh` 0.2.2-alpha.2), both one-launch and
unretried. Reports: [launcher-ready.md](../../../../experiments/low-memory-build/reports/launcher-ready.md),
[launcher-ready-recheck.md](../../../../experiments/low-memory-build/reports/launcher-ready-recheck.md).

### 8.1 Run 1 — product criteria green, aggregate FAIL on one wrong harness assertion

`2026-11-01T10:06:31Z`, unit `dsh-launcher-ready-643913.service`, launched as
`node apps/cli/lib/bin.js --profile host-smoke-20261101t1622z-a7f3 --patch /tmp/observer.yml`
inside `systemd-run --service-type=exec --wait --pipe --collect`
(`MemoryMax=1536M MemorySwapMax=0 TasksMax=32 RuntimeMaxSec=120`), bwrap `--ro-bind / /`,
private pid/net/ipc/uts, tmpfs `/tmp`, `env -i`, `--max-old-space-size=1024`; production
`/root/.dsh` stat-only. Observed: READY from the real `appReady` after 3626 ms, CLI
`code=0 signal=null` on one `SIGTERM`, stderr 0 bytes, 98 composition rows with the
observer row and the `dsh-hmr` row present, originals `f2270c13…` / `1831f1dc…` identical,
peak 226.8 MiB. **Aggregate verdict as executed: FAIL** — on exactly one assertion,
`owned-listener-never-fired :: cleanupPendingFired=true`, which was itself wrong:
`commit()` drains the listener Set (`apps/cli/src/profile-boot.ts:44-65`), so a listener
still subscribed at commit *must* fire. The harness was corrected afterwards and, at that
point, the correction was **unexecuted**.

### 8.2 Run 2 — PASS 13/13, envelope read inside the unit

`2026-11-01T10:10:13Z` → `10:10:16Z`, unit `dsh-launcher-ready-recheck-644238.service`,
log `launcher-ready-recheck.log`, summary `launcher-ready-recheck.summary`.
`PARENT_ASSERT_COUNTS total=13 pass=13 fail=0 skip=0`; `launch_rc=0`, `systemd_rc=0`,
`parent_verdict_pass=1`. READY `after_ms=2490`; CLI exit `code=0 signal=null`, close at
3007 ms with `signal_sent=SIGTERM`; `committedBeforeProbes=false`, so the
pending-cancellation probe was genuinely exercised rather than inferred. Effective cgroup
read **in-unit**: `/sys/fs/cgroup/system.slice/dsh-launcher-ready-recheck-644238.service`,
`memory.max=1610612736`, `memory.swap.max=0`, `pids.max=32`; `memory.peak=192036864` B
(≈183.1 MiB), swap 0, pids 12 at end; memory gate 1999 MiB ≥ 1700; originals unchanged.

**Scope, stated narrowly.** 13/13 is **CLI service readiness** — one service's `appReady`
contract. It is explicitly *not* Web/browser/GUI health, not all-plugin health, and not
HMR watcher state (`launcher-ready-recheck.md`, "What this does not show"). No listener,
port, network, install, build or production read occurred; the existing GUI on 3080 was
untouched. So this row may never be cited as browser, GUI or Web evidence, and the
earlier `hmr` warning does not license a claim in either direction.

**Kit relevance is narrow, and only this far:** the run's `bootstrap.mjs` derived the
accepted NONCE/KIT environment **through the kit's own `readLayout`**, and the composed
tree included the observer row. The run proves the launcher commits a profiled tree; it
does **not** exercise `writeScaffold`, the declaration validator or any generated plugin.

## 9. Boundary — what the later rounds still do not cover for this package

1. Real kit output was loaded by the official built Loader in **exactly one green run**
   (§7.2), for one `include`-mounted generated plugin, under a **temporary** profile;
   broad multi-plugin, long-running or production-profile behaviour remains unexercised.
2. The **guard** rounds are not kit evidence. The 16:45 refusal run mounted a
   **handwritten** fixture target and says so itself ("Not proof that `dsh-plugin-kit`
   emits a working plugin"); the 17:22 / 17:30 / 17:40 agent-guard rounds exercise the
   test driver's ownership port and the native guard gate. See
   [dsh-agent-test-driver records](../../../dsh-agent-test-driver/docs/testing/2026-11-01-historical-test-records.md) §9.
3. No browser, Web surface, port or GUI was exercised in any stage of this package's
   history; §8's 13/13 is CLI readiness only.
4. The generator's known limits are unchanged by every later run: a partial scaffold is
   explicitly **non-transactional** (not rolled back), and a pre-existing destination is
   refused rather than overwritten. No later stage tested either limit.
5. Revision pinning is unchanged (§4). The lifecycle and launcher rows carry no commit for
   *this* package; §7.2's profile digests are **input** digests, not source revisions, and
   must not be cited as such.
