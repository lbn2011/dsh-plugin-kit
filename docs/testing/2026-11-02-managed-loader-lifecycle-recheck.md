# Managed Loader lifecycle recheck — one real launch, one attempt (2026-11-02)

Status: **PASSED — one launch, one attempt, launcher exit `0`, run record `"status":"passed"`.**
The skeleton (sections 1–3) was written **before** the launch and is preserved as written;
section 4 records what the single attempt actually produced. No retry was made and none is
needed: the first authorized attempt completed naturally and validated.

Run identifier: `20261101T173533Z` → runtime root
`experiments/dsh-live-lab/managed-cleanup/work/run-20261101T173533Z`.

## 1. Why this run exists

The managed template's reference to the Loader's cleanup integration has been exercised
only as **text** (the kit's `managed-template` suite) and as synthetic fixture behaviour.
Neither of those boots a real Loader. This attempt is the one authorized real-host launch
that exercises the actual cleanup integration through the existing launcher, and it is
the *only* attempt: one launch, launcher errors included, no retry.

What it is meant to observe, if and only if the run reports it:

- the native `close` is called **exactly once** by the fiber cleanup path;
- the close rejection is surfaced (aggregate / scope-failure identity) rather than swallowed;
- after a throwing `unsubscribe`, the scope **continues** draining, and a counted
  `unregister`-style callback runs exactly once, invoking the exact native disposer;
- a **stale generation**'s close does not re-run generation-1 disposers and does not reach
  generation 2.

**Absence of native tools in the environment is not, by itself, causal proof** about the
kit's template. It is an environment observation; the causal claim would need the arm's
own assertions, which is why the arm records — not a tool inventory — are what this run is
judged on.

## 2. Authorization envelope, as issued

| item | value |
| --- | --- |
| unit | `managed-cleanup-20261101T173533Z` (transient, `--collect`; no unit file installed) |
| type | `Type=exec` |
| memory | `MemoryMax=768M`, `MemorySwapMax=0` |
| tasks | `TasksMax=32` |
| runtime | `RuntimeMaxSec=120` |
| CPU | **unbounded** — no `CPUQuota`, no `CPUWeight`, no `AllowedCPUs` (approved real-host budget; the memory reduction is not a throughput claim) |
| V8 old space | `--max-old-space-size=384`, passed as a **literal** by the launcher (§3a) |
| capacity gate | `MemAvailable ≥ 1200 MiB`, read **once** inside the unit, no polling |
| invocation | `/usr/bin/bash <slice>/run-isolated.sh` — the **explicit interpreter**; the file's `0600` mode (no executable bit) is irrelevant because bash reads it |
| confinement | one `bwrap`: host `/` read-only, private pid/ipc/uts/cgroup/net, fresh `proc`/`dev`, `tmpfs /tmp`, **exactly one writable mount** = this run's root, `--die-with-parent`, `--new-session`, `--clearenv` + explicit env |
| scope of work | `prepare.mjs --step all`, `arm-generated.mjs`, `arm-fault.mjs`, `validate-records.mjs` — **all** inside that one envelope |

Exact command issued (from `experiments/dsh-live-lab/managed-cleanup/`):

```sh
systemd-run --quiet --wait --pipe --collect \
  --unit "managed-cleanup-20261101T173533Z" \
  --property=Type=exec \
  --property=MemoryMax=768M \
  --property=MemorySwapMax=0 \
  --property=TasksMax=32 \
  --property=RuntimeMaxSec=120 \
  --setenv=DSH_MANAGED_CLEANUP_ROOT="$PWD/work/run-20261101T173533Z" \
  --setenv=DSH_MANAGED_CLEANUP_ALLOW_ROOT="$PWD" \
  --setenv=NODE_BIN="$(command -v node)" \
  /usr/bin/bash "$PWD/run-isolated.sh"
```

### 2.1 Pre-launch state

- **No competing managed test units.** Checked immediately before the attempt:
  `systemctl list-units --all` showed only `dsh-web.service` (running),
  `dsh-patch-check.timer`/`.service`, and the pre-existing unrelated `rc-local.service`
  failure. Nothing named `managed-*`/`cleanup-*` existed; no service was stopped, disabled
  or otherwise altered by this attempt.
- **Root does not pre-exist.** `work/run-20261101T173533Z` was *not* created by hand; the
  launcher creates it. Pre-existing roots are
  `work/run-20261101T163853Z` and `work/run-20261101T171007Z` — untouched, not deleted,
  not reused.
- **No copies, no overwrite, no install, no build, no `--force`, nothing written under
  `/root/.dsh`, nothing on `:3080`.** The only writable path in the sandbox is the run
  root; the repository and the Node install are read-only binds.
- Source hashes recorded **before** launch in
  `reports/2026-11-02-managed-loader-lifecycle-recheck/30-sources-sha256-before.txt`
  (81 files: kit `src`/`templates`/`tests`, the slice's launcher/payload/arms/validator/
  fixtures/lib, and the pinned Cordis checkout).

## 3. What is captured

| item | source |
| --- | --- |
| unique unit name | issued above; `systemctl show` after the unit is gone is not available (`--collect`), so the name is also echoed by the launcher's `launching` JSON |
| exact argv | §2 plus the launcher's own `launching` line (`runtimeRoot`, `node`, `nodeOptions`, `nodeHeapMiB`, `bwrap`, `sentinel`, `log`, `writableMounts=1`) |
| exit status | `systemd-run --wait` returns the unit's status; the launcher's own `finished` JSON carries `payloadRc` |
| effective limits | read **inside the unit** by the launcher from `/sys/fs/cgroup/...` before any child runs: `memory.max`, `memory.swap.max`, `pids.max`, `cpu.max`, `cgroup.type`; plus `systemctl show` `Type` and `RuntimeMaxUSec` |
| `memory.peak` | intended to be read from the unit's cgroup — **the skeleton anticipated this correctly**: under `--collect` the unit is gone at exit, so it came back `unavailable` and is recorded as such, not guessed (see §4.1) |
| source hashes after | `30-sources-sha256-after.txt`, compared to the before-manifest |
| runtime records | `<root>/records/arm-generated.json`, `arm-fault.json`, `run.json`; `<root>/logs/payload.log` (the confined payload's every line), `<root>/logs/launched.once` (the one-launch marker) |
| arm statuses / counters | the two arm records' `status` + assertion ids/`ok`, plus the counters the fault arm writes (`unregisterRuns`, `unsubscribeRuns`, trace step indices, generation-2 counter) |
| natural exit | required — the launcher waits for `bwrap` to exit on its own and never kills it; nothing in this attempt sends a signal |

### 3.1 Labelling, fixed in advance

- The **generated** arm's artifact must be unchanged from the real scaffold; if the record
  shows otherwise, that is a finding, not something to edit.
- The **fault** arm's fault injection is **synthetic** and will be labelled as synthetic in
  the result. A synthetic fault demonstrates the wrapper's behaviour under that injected
  failure; it is not evidence about a real upstream defect.

## 4. Result

**The attempt ran once and passed.** Issued `2026-11-01T17:35:59Z`, finished
`2026-11-01T17:36:03Z`; `systemd-run --wait` returned **`EXIT_STATUS=0`**.

### 4.1 The launcher's own read-back (authority for the effective limits)

The launcher refuses before starting a child unless it has read the limits back from the
kernel and from systemd. Its `launching` line is that read-back, and it matches the
issued properties exactly:

```json
"preflight":{"unit":"managed-cleanup-20261101T173533Z.service","unitType":"exec",
"runtimeMaxSeconds":120.000,"memAvailableMiB":1663,"memGateMiB":1200,
"memoryMaxBytes":805306368,"memorySwapMax":0,"pidsMax":32}
```

| property | issued | read back inside the unit |
| --- | --- | --- |
| type | `Type=exec` | `unitType=exec` |
| `MemoryMax` | `768M` | `memoryMaxBytes=805306368` (= 768 MiB) |
| `MemorySwapMax` | `0` | `memorySwapMax=0` |
| `TasksMax` | `32` | `pidsMax=32` |
| `RuntimeMaxSec` | `120` | `runtimeMaxSeconds=120.000` |
| CPU | unbounded (no quota issued) | no CPU property issued; nothing to read back |
| capacity gate | `MemAvailable ≥ 1200 MiB`, once | `memAvailableMiB=1663`, `memGateMiB=1200` — one sample |
| writable mounts | exactly one (the run root) | `"writableMounts":1` |
| V8 old space | literal `--max-old-space-size=384` | `"nodeOptions":"--max-old-space-size=384"`, `"nodeHeapMiB":384` |

`memory.peak` is **unavailable, and is recorded as unavailable rather than guessed**.
`--collect` removes the transient unit when it exits, so
`/sys/fs/cgroup/system.slice/managed-cleanup-20261101T173533Z.service` no longer existed
when the post-run read was attempted. This is a deliberate consequence of `--collect`
(no lingering failed unit), and it is the reason this recheck has **no** peak-memory
figure, unlike the cgroup-accounted 2026-11-02 lifecycle regression.

**Do not read the post-run `systemctl show` as limits.** With `LoadState=not-found` it
returns defaults (`RuntimeMaxUSec=infinity`, `MemoryMax=infinity`, `TasksMax=4652`,
`CPUQuotaPerSecUSec=infinity`). Those are the values systemd reports for a unit that does
not exist, not this run's properties; the `preflight` JSON above is the only valid
read-back. Post-run `systemctl list-units` confirms **no unit remains**, and
`systemctl list-units --failed` was not polluted.

### 4.2 Confined environment, as the payload saw it

```
node v24.21.0
root  …/work/run-20261101T173533Z
path  /www/server/nodejs/v24.21.0/bin:/usr/local/bin:/usr/bin:/bin
home  …/work/run-20261101T173533Z/home
cwd   …/managed-cleanup
```

The heap probe reported, from inside the confinement:

```
nodeOptions "--max-old-space-size=384"  oldSpaceMiB 384
heapSizeLimitBytes 603979776  heapSizeLimitMiB 576  totalOverOldSpace 1.5  rc 0
```

`576 MiB` total V8 heap against a `384 MiB` old-space budget — consistent with the
documented expectation that the total exceeds old space (V8's arithmetic suggested ~432;
the observed value is 576). Both figures are reported, neither is asserted equal, and the
probe passed because the limit was finite, present and not below the old-space budget.

The write boundary was **measured, not inferred**: the generated arm's
`read-only-mount-refuses-write` assertion got `EROFS` when it tried to create
`.managed-cleanup-write-probe-26-…` under the read-only `build-checkout`, and recorded
`"enforced":true,"outcome":"refused"`.

### 4.3 Records: three files, 86 assertions, all `ok`

| record | `type` | `status` | assertions | rc |
| --- | --- | --- | --- | --- |
| `records/generated.json` | `managed-cleanup/generated` | `passed` | 23 / 23 ok | 0 |
| `records/fault.json` | `managed-cleanup/fault` | `passed` | 53 / 53 ok | 0 |
| `records/run.json` | `managed-cleanup/run` | `passed` | 10 / 10 ok | 0 |

The launcher's postcondition on the artifact: `"payloadRc":0`, `"runRecordPassed":"yes"`,
`"recordProblem":"NONE"`, `"recordLines":1`. The payload's final status is the validator's,
not a `grep`, and the validator re-read both arm records, checked each assertion shape and
that each arm's exit code agreed with its own record before writing `passed`.

### 4.4 The four lifecycle questions, answered by the records

These are the run's actual counters, quoted from `records/fault.json`
(`reports/2026-11-02-managed-loader-lifecycle-recheck/36-lifecycle-counters.txt`).

**(a) Native close called exactly once by fiber cleanup — yes.**

```
close-called-once-by-fiber-cleanup  {"attempts": 1, "callSites": ["fiber-cleanup"]}
```

One attempt, and the call site is the fiber cleanup path — not the arm calling `close()`
itself. The subject of that arm is the **synthetic-fault fixture**
(`plugins/fault/managed-fault.plugin.mjs`, copied from `fixtures/managed-fault.plugin.mjs`),
explicitly *not* the generated artifact.

**(b) The rejection is surfaced, not swallowed — yes.**

```
close-promise-rejected               {"rejectionObservedAt":"rejected","rejectionName":"AggregateError"}
close-promise-await-independently-rejects {"settlement":"rejected"}
close-rejection-is-scope-failed      {"code":"ERR_CLEANUP_SCOPE_FAILED","name":"AggregateError"}
close-rejection-is-aggregate         {"isAggregate":true,"members":1}
loader-unload-fulfilled-despite-failing-cleanup
  {"unloadSettlement":"fulfilled","unloadError":null,"closeAttempts":1,
   "closeSettlement":"rejected","closeRejectionName":"AggregateError",
   "closeRejectionHandledPromptly":true}
```

The Loader's unload fulfilled **while** the close promise the fixture holds rejected —
both halves observed, which is the point: the Loader catches each disposer and logs it
(`vendor/cordis/src/fiber.ts:712-730`), and this records that swallowing against an
*observed* rejection rather than against the Loader's silence. A second, independent
observer (not the Loader log) also saw the rejection.

**(c) The scope continues past a throwing `unsubscribe`, and the counted wrapper runs once — yes.**

```
counted-callback-ran-after-the-throwing-unsubscribe
  {"unsubscribeIndex":4,"callbackIndex":6,
   "steps":["port:register","port:register:done","port:subscribe","apply:returned",
            "dispose:unsubscribe","close:called","dispose:unregister:callback",
            "dispose:unregister:native","close:rejected"]}
counted-unregister-callback-ran-once  {"count":1,"counterOnInstance":1}
fixture-counter-agrees-with-trace      {"counter":1}
counted-callback-invoked-the-exact-native-disposer {"invokedExact":true}
```

The drain is LIFO: the throwing `unsubscribe` sits at index 4, the counted callback at
index 6, so a scope that stopped at the first failure could not have reached it. The
counter agrees between trace and fixture instance, and the callback invoked the *very*
function `ctx.tools.register()` returned.

**(d) A stale generation's close is inert — yes.**

```
stale-close-returns-the-same-promise       {"samePromise":true}
stale-close-still-rejects                  {"settlement":"rejected"}
stale-close-rejection-identity-preserved   {"sameErrorObject":true,"name":"AggregateError"}
stale-close-did-not-rerun-generation-1-disposers {"unsubscribeRuns":1}
stale-close-did-not-reach-generation-2     {"generation2Counter":0}
stale-close-left-live-registration-intact / stale-close-left-dispatch-working
generation-2-cleanup-ran-exactly-once-on-host-teardown
  {"unregisterRuns":1,"invokedExactDisposer":true,
   "tracesByGeneration":[{"generation":1,"unregisterRuns":1},{"generation":2,"unregisterRuns":1}]}
```

Calling the stale handle again returned the **same promise object**, generation-1
disposers ran once in total (`unsubscribeRuns:1`), generation 2 was untouched
(`generation2Counter:0`), the live registration still answered (`generation 2: three`),
and generation 2's own cleanup ran exactly once at host teardown.

### 4.5 The generated artifact is unchanged from the real scaffold

`generated-files-unchanged` compares a fixed allowlist of the 7 generated sources, before
and after the boot, by `lstat` — never a recursive walk over `node_modules` links:

```
before {"files":7,"digest":"edce938802cb15ee45feb334dad9cf67f3f601ad7d72554684e7e62d42113e5a"}
after  {"files":7,"digest":"edce938802cb15ee45feb334dad9cf67f3f601ad7d72554684e7e62d42113e5a","problems":[]}
```

The scaffold wrote exactly the 7 expected files (`generated-allowlist-complete-before`),
the `kitSpecifier` recorded verbatim as `file:/root/dsh-ecosystem-spec/projects/dsh-plugin-kit`,
and `protected-paths-untouched` reported `"unchanged":true,"changed":[]`.

**Synthetic fault, labelled.** The fault arm's `apply` deliberately throws a
`SyntheticUnsubscribeFault` from its unsubscribe disposer (`"original-fault-preserved-by-identity"`
records `"faultName":"SyntheticUnsubscribeFault","faultGeneration":1`). That fault is
**injected**, so the arm demonstrates the wrapper's and the scope's behaviour *under an
injected failure*; it is not evidence that any upstream or generated plugin has a failing
cleanup path. The generated arm itself declares `"that the generated artifact has a failing
cleanup path (it does not)"`.

### 4.6 Non-blocking observations, recorded rather than explained away

- `prepare --step all` reported `"readmeCheck":"stale"` and `"note":"Nothing was booted and no tool was called by this step."` — informational; `prepare` exited `0`.
- Both arms logged `dsh: warning: 20 entries did not activate` followed by the pending
  plugin list (`tool-bash`, `tool-fs`, `subagent*`, `workflow-ptc`, …). This is the
  headless profile this slice boots — the rows those entries need (`workingDirectory`, `fs`,
  `headlessStartup`, `shell`) are not installed in it. It is identical on both arms, it did
  not affect either arm's assertions, and it is an environment property of the slice, not a
  finding about the kit.
- `teardown-window-observed` measured `2 ms` and states plainly that it is *reported, never
  accepted or rejected* — there is still no latency gate anywhere in this slice, and this
  record asserts none.
- On both arms the native effect stays the host's; `notClaimed` in each record explicitly
  disclaims that tool retraction alone attributes anything to the kit's drain.

## 5. Interpretation limits to restate in the result

1. `memory.peak`, if captured, is this unit's measurement — not a memory profile and not a
   proxy for throughput.
2. A `bwrap` mount boundary is enforced by the kernel; the stat/hash comparison is
   metadata corroboration only.
3. Native-tool absence inside the sandbox is an environment fact; it is not on its own
   proof about the kit template's cleanup integration.
4. One launch, one root. This run's root is spent afterwards by design.

## 6. Evidence index

| file | contents |
| --- | --- |
| `reports/2026-11-02-managed-loader-lifecycle-recheck/30-sources-sha256-before.txt` | 81-file pre-launch manifest |
| `…/31-launch.txt` | run id, cwd, issued/finished timestamps, `EXIT_STATUS=0` |
| `…/32-launcher-output.txt` | the full 63-line unit output: `launching` preflight JSON, prepare steps, both arm records, run record, `finished` |
| `…/32b-payload-log.txt` | the confined payload's own log (identical content to the in-root `logs/payload.log`) |
| `…/33-unit-limits.txt` | post-run unit state; `LoadState=not-found` (read §4.1 before quoting its defaults) |
| `…/34-sources-sha256-after.txt` | 81-file post-launch manifest — **identical to before, 81/81** |
| `…/35-records.txt` | root tree, record files, generated allowlist, per-record assertion tallies |
| `…/36-lifecycle-counters.txt` | the 15 lifecycle assertions with full `detail` (§4.4) |

Runtime artifacts left in place, untouched: `work/run-20261101T173533Z/` with `logs/` (the
launch marker `launched.once` and `payload.log`), `records/`, `generated/`, `plugins/fault/`,
`home/` and `prepare.json`. That root is now **spent** — its marker exists, and a further
launch would require a new root named by the Lead, not a reuse of this one.

Historical context for the failures this run must not repeat:
`docs/testing/2026-11-02-managed-loader-bash-acceptance.md`,
`docs/testing/2026-11-02-managed-loader-768-acceptance.md`,
`docs/testing/2026-11-02-managed-parent-regression.md`,
`docs/testing/2026-11-01-managed-loader-acceptance.md`.
